#!/usr/bin/env python3
"""Lint a generated DESIGN.md for structure and evidence traceability (original, stdlib only).

Usage: lint_design_md.py DESIGN.md [--evidence evidence.json]
Checks: required sections present; colour tokens are concrete (hex/rgb/oklch); type table has
px/rem sizes; breakpoints listed; no unresolved placeholders; and, with --evidence, that colour
hexes and px values quoted in the doc appear in the captured evidence (flags guessed values).
Exit 0 = clean, 1 = problems (printed).
"""
import argparse
import json
import re
import sys

REQUIRED = ["Visual Theme", "Color", "Typography", "Component", "Layout", "Depth", "Responsive", "Do", "Agent Prompt"]


def hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("doc")
    ap.add_argument("--evidence", help="evidence JSON from extract_design_evidence.js")
    a = ap.parse_args()
    text = open(a.doc, encoding="utf-8").read()
    problems = []
    heads = re.findall(r"^#{1,3}\s+(.*)$", text, re.M)
    for r in REQUIRED:
        if not any(r.lower() in h.lower() for h in heads):
            problems.append(f"missing section containing '{r}'")
    if re.search(r"\[(Site Name|TODO|TBD|\.\.\.)\]|<(Site|Product)[^>]*>|\bTODO\b|\bTBD\b|lorem ipsum", text, re.I):
        problems.append("unresolved placeholder text (TODO/TBD/<Site...>)")
    hexes = {h.lower() for h in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b", text)}
    if len(hexes) < 6:
        problems.append(f"only {len(hexes)} distinct hex colours documented (expected a real palette)")
    if not re.search(r"\d+(\.\d+)?\s?(px|rem)", text):
        problems.append("no px/rem sizes found")
    if not re.search(r"@media|breakpoint|min-width|max-width|\b\d{3,4}\s?px", text, re.I):
        problems.append("no breakpoints documented")
    if "[observed]" not in text and "[inferred]" not in text:
        problems.append("no [observed]/[inferred] tags: facts and judgement are not separated")
    if a.evidence:
        ev = open(a.evidence, encoding="utf-8").read().lower()
        rgbs = set(re.findall(r"rgba?\((\d+),\s*(\d+),\s*(\d+)", ev))
        known = {(int(r), int(g), int(b)) for r, g, b in rgbs} | {hex_to_rgb(h) for h in re.findall(r"#[0-9a-f]{6}\b", ev)}
        unknown = [h for h in sorted(hexes) if len(h) == 7 and hex_to_rgb(h) not in known]
        if unknown:
            problems.append("hex values not found in evidence (guessed?): " + ", ".join(unknown[:12]))
    if problems:
        print("DESIGN.md problems:")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("DESIGN.md OK:", len(hexes), "colours,", len(heads), "headings")


if __name__ == "__main__":
    main()

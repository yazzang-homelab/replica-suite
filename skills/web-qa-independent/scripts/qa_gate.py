#!/usr/bin/env python3
"""Mechanical release gate for a website clone (original implementation, stdlib only).

Consumes artifacts from web-verify-pixel:
  --diff     diff/report.json                     (pixel_diff.py)
  --replica  replica/<prefix>-runtime.json        (capture_matrix.mjs, replica)
  --ref      reference/<prefix>-runtime.json      (optional; upstream baseline)
Emits a PASS/BLOCK verdict plus P0/P1/P2 findings as JSON on stdout and, with --out,
to a file. Exit 0 = PASS, 2 = BLOCK. This is the *mechanical* half of independent QA;
the reviewer still has to look at screenshots and exercise interactions.

Severity rules
  P0 (blocks): missing screenshot, size mismatch, page height mismatch, replica-only
               page/console errors, broken images, canvas count mismatch,
               changedRatio above --max-ratio.
  P1 (blocks): horizontal overflow only in replica, replica-only failed HTTP requests,
               changedRatio above --warn-ratio (but within --max-ratio).
  P0 (blocks): also empty/unreadable/malformed inputs (no evidence is never a PASS),
               nonfinite changedRatio, replica viewport missing from --ref (or vice versa).
  P2 (reported): anything that also happens on the reference (inherited upstream noise).
"""
import argparse
import json
import math
import sys


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def strs(v):
    return isinstance(v, list) and all(isinstance(x, str) for x in v)


def http_list(v):
    return isinstance(v, list) and all(isinstance(e, dict) and isinstance(e.get("url"), str) and "status" in e for e in v)


def viewport_problem(h, need_base):
    """Return a description of the first structural problem in a viewport record, or None."""
    if not isinstance(h, dict):
        return "viewport record is not an object"
    for k in ("pageErrors", "consoleErrors", "badImages"):
        if not strs(h.get(k)):
            return f"{k} missing or not a list of strings"
    if not http_list(h.get("httpErrors")):
        return "httpErrors missing or malformed"
    if not isinstance(h.get("horizontalOverflow"), bool):
        return "horizontalOverflow missing or not a boolean"
    if not num(h.get("scrollHeight")):
        return "scrollHeight missing or not a finite number"
    if not isinstance(h.get("canvases"), list):
        return "canvases missing or not a list"
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--diff", required=True)
    ap.add_argument("--replica", required=True)
    ap.add_argument("--ref")
    ap.add_argument("--max-ratio", type=float, default=0.0, help="P0 above this changedRatio (default 0 = exact)")
    ap.add_argument("--warn-ratio", type=float, default=0.0, help="P1 above this changedRatio (set below --max-ratio)")
    ap.add_argument("--height-tolerance", type=int, default=0, help="allowed scrollHeight delta in px")
    ap.add_argument("--out")
    a = ap.parse_args()
    if not (math.isfinite(a.max_ratio) and math.isfinite(a.warn_ratio)) or a.max_ratio < 0 or a.warn_ratio < 0:
        ap.error("--max-ratio/--warn-ratio must be finite and >= 0")
    if a.height_tolerance < 0:
        ap.error("--height-tolerance must be >= 0")

    findings = []

    def add(sev, where, msg):
        findings.append({"severity": sev, "where": where, "message": msg})

    def read(path, label):
        try:
            return load(path)
        except (OSError, ValueError) as e:
            add("P0", label, f"cannot read {label} report {path}: {e}")
            return None

    diff = read(a.diff, "diff")
    if diff is not None:
        if not isinstance(diff, list) or not diff:
            add("P0", "diff", "diff report must be a non-empty list; no screenshot evidence")
            diff = []
    else:
        diff = []
    for idx, r in enumerate(diff):
        n = r.get("name") if isinstance(r, dict) else None
        if not isinstance(n, str) or not n:
            add("P0", f"diff[{idx}]", "diff entry is not an object with a name")
            continue
        if r.get("missing") is True:
            add("P0", n, "screenshot pair missing")
            continue
        ratio = r.get("changedRatio")
        if not num(ratio) or ratio < 0 or not isinstance(r.get("sizeMismatch"), bool):
            add("P0", n, f"malformed diff entry: changedRatio={ratio!r} sizeMismatch={r.get('sizeMismatch')!r}")
            continue
        if r["sizeMismatch"]:
            add("P0", n, f"size mismatch ref={r.get('refSize')} replica={r.get('repSize')}")
        if ratio > a.max_ratio:
            bands = r.get("worstBands")
            band = bands[0] if isinstance(bands, list) and bands else None
            add("P0", n, f"changedRatio {ratio} > {a.max_ratio}; max delta {r.get('maxChannelDelta')}; "
                         f"worst band {band}; overlay {r.get('diff')}")
        elif ratio > a.warn_ratio:
            add("P1", n, f"changedRatio {ratio} > warn {a.warn_ratio}")

    def viewports(path, label):
        doc = read(path, label)
        if doc is None:
            return None
        vps = doc.get("viewports") if isinstance(doc, dict) else None
        if not isinstance(vps, dict) or not vps:
            add("P0", label, f"{label} report needs a non-empty 'viewports' object; no runtime evidence")
            return None
        return vps

    rep = viewports(a.replica, "replica") or {}
    ref = {}
    if a.ref:
        ref = viewports(a.ref, "ref") or {}
    if a.ref and ref and rep:
        for vp in ref:
            if vp not in rep:
                add("P0", vp, "viewport present in ref but missing from replica")
    for vp, h in rep.items():
        problem = viewport_problem(h, bool(a.ref))
        if problem:
            add("P0", vp, f"malformed replica viewport: {problem}")
            continue
        if a.ref:
            if vp not in ref:
                add("P0", vp, "viewport present in replica but missing from ref")
                continue
        base = ref.get(vp, {})
        if a.ref:
            problem = viewport_problem(base, True)
            if problem:
                add("P0", vp, f"malformed ref viewport: {problem}")
                continue
        base_console = set(base.get("consoleErrors", []))
        base_urls = {e["url"] for e in base.get("httpErrors", [])}
        base_bad = set(base.get("badImages", []))
        for e in h["pageErrors"]:
            add("P0", vp, f"page error: {e[:200]}")
        for e in h["consoleErrors"]:
            add("P2" if e in base_console else "P0", vp, f"console error: {e[:200]}")
        for e in h["httpErrors"]:
            add("P2" if e["url"] in base_urls else "P1", vp, f"HTTP {e['status']} {e['url'][:160]}")
        for src in h["badImages"]:
            add("P2" if src in base_bad else "P0", vp, f"broken image {src[:160]}")
        if h["horizontalOverflow"] and not base.get("horizontalOverflow"):
            add("P1", vp, "horizontal overflow present only in replica")
        if base:
            if abs(h["scrollHeight"] - base["scrollHeight"]) > a.height_tolerance:
                add("P0", vp, f"page height replica={h['scrollHeight']} ref={base['scrollHeight']}")
            if len(h["canvases"]) != len(base["canvases"]):
                add("P0", vp, f"canvas count replica={len(h['canvases'])} ref={len(base['canvases'])}")

    blocking = [f for f in findings if f["severity"] in ("P0", "P1")]
    result = {"verdict": "BLOCK" if blocking else "PASS",
              "counts": {s: sum(f["severity"] == s for f in findings) for s in ("P0", "P1", "P2")},
              "findings": findings}
    text = json.dumps(result, indent=2)
    print(text)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(text)
    sys.exit(2 if blocking else 0)


if __name__ == "__main__":
    main()

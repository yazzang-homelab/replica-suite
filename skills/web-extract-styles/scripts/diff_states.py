#!/usr/bin/env python3
"""Diff two extract-styles.js outputs (state A vs state B) into a behaviour spec (original).

Usage: diff_states.py stateA.json stateB.json
Walks both trees in lockstep (by child index) and prints `path: prop  A -> B` for every
changed style/rect/text value. Paste the result into the component spec's "States" section
together with the trigger and the transition CSS.
"""
import json, sys


def walk(a, b, path, out):
    if not isinstance(a, dict) or not isinstance(b, dict):
        return
    for sec in ("style", "rect", "attrs"):
        da, db = a.get(sec) or {}, b.get(sec) or {}
        for k in sorted(set(da) | set(db)):
            if da.get(k) != db.get(k):
                out.append(f"{path}[{sec}]: {k}  {da.get(k)!r} -> {db.get(k)!r}")
    if a.get("text") != b.get("text"):
        out.append(f"{path}[text]: {a.get('text')!r} -> {b.get('text')!r}")
    ca, cb = a.get("children"), b.get("children")
    if isinstance(ca, list) and isinstance(cb, list):
        if len(ca) != len(cb):
            out.append(f"{path}: child count {len(ca)} -> {len(cb)}")
        for i, (x, y) in enumerate(zip(ca, cb)):
            walk(x, y, f"{path}>{y.get('tag')}[{i}]", out)


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    a, b = (json.load(open(p)) for p in sys.argv[1:])
    out = []
    walk(a, b, a.get("tag", "root"), out)
    print("\n".join(out) or "NO DIFFERENCES (state did not change anything measurable)")


if __name__ == "__main__":
    main()

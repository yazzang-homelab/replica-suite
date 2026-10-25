#!/usr/bin/env python3
"""Pixel-diff reference vs replica screenshots (original implementation).

Reads PNGs (what Playwright/Chromium emit) as RGBA, alpha preserved, via the
shared Pillow-based lib/images.py.

Layout expected (produced by capture_matrix.mjs):
  <root>/<ref>/<prefix>-<W>x<H>-<kind>.png   kind = top | full
  <root>/<rep>/<prefix>-<W>x<H>-<kind>.png
Writes <root>/<out>/<name>-diff.png (changed pixels painted magenta over the
reference, optional per-band table) and <root>/<out>/report.json.

Exit code 0 = pass, 2 = fail (only with --strict or any threshold flag exceeded).
"""
import argparse
import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from lib.images import ImageError, load_rgba, save_rgba  # noqa: E402

def compare(ref_path, rep_path, diff_path, threshold, bands):
    try:
        rw, rh, ref = load_rgba(ref_path)
        pw, ph, rep = load_rgba(rep_path)
    except (ImageError, OSError) as exc:
        raise SystemExit(f"pixel_diff: {exc}")
    cw, ch = min(rw, pw), min(rh, ph)
    if (rw, rh) == (pw, ph) and ref == rep:  # identical bytes: skip the per-pixel loop
        save_rgba(diff_path, cw, ch, ref)
        return {"refSize": [rw, rh], "repSize": [pw, ph], "sizeMismatch": False, "changedPixels": 0,
                "totalPixels": cw * ch, "changedRatio": 0, "avgChannelDelta": 0, "maxChannelDelta": 0,
                "bbox": None, "worstBands": [], "diff": diff_path}
    out = bytearray(cw * ch * 4)
    changed = 0
    total_delta = 0
    max_delta = 0
    band_h = max(1, ch // bands)
    band_counts = [0] * (ch // band_h + 1)
    minx, miny, maxx, maxy = cw, ch, -1, -1
    for y in range(ch):
        for x in range(cw):
            a = (y * rw + x) * 4
            b = (y * pw + x) * 4
            d = max(abs(ref[a + c] - rep[b + c]) for c in range(4))
            o = (y * cw + x) * 4
            total_delta += (abs(ref[a] - rep[b]) + abs(ref[a + 1] - rep[b + 1]) + abs(ref[a + 2] - rep[b + 2])) / 3
            if d > max_delta:
                max_delta = d
            if d > threshold:
                changed += 1
                band_counts[y // band_h] += 1
                minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
                out[o:o + 4] = bytes((255, 0, 255, 255))
            else:
                # dimmed reference so highlights stand out
                out[o:o + 4] = bytes((ref[a] // 2 + 127, ref[a + 1] // 2 + 127, ref[a + 2] // 2 + 127, 255))
    save_rgba(diff_path, cw, ch, out)
    total = cw * ch
    return {
        "refSize": [rw, rh], "repSize": [pw, ph], "sizeMismatch": [rw, rh] != [pw, ph],
        "changedPixels": changed, "totalPixels": total,
        "changedRatio": round(changed / total, 8) if total else 0,
        "avgChannelDelta": round(total_delta / total, 5) if total else 0,
        "maxChannelDelta": max_delta,
        "bbox": [minx, miny, maxx, maxy] if changed else None,
        "worstBands": sorted(
            ({"yStart": i * band_h, "yEnd": min(ch, (i + 1) * band_h), "changed": n}
             for i, n in enumerate(band_counts) if n),
            key=lambda r: -r["changed"])[:5],
        "diff": diff_path,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", required=True)
    ap.add_argument("--ref", default="reference")
    ap.add_argument("--rep", default="replica")
    ap.add_argument("--out", default="diff")
    ap.add_argument("--prefix", default="site")
    ap.add_argument("--viewports", default="1920x1000,1440x1000,1024x1000,768x1000,375x812")
    ap.add_argument("--kinds", default="top,full")
    ap.add_argument("--threshold", type=int, default=16, help="per-channel delta (0-255) counted as changed")
    ap.add_argument("--max-ratio", type=float, default=None, help="fail when changedRatio exceeds this (e.g. 0.002)")
    ap.add_argument("--bands", type=int, default=20, help="vertical bands for locating the worst regions")
    ap.add_argument("--strict", action="store_true", help="fail on ANY changed pixel or size mismatch")
    a = ap.parse_args()
    if a.bands < 1 or not 0 <= a.threshold <= 255:
        ap.error("bands must be positive and threshold must be 0..255")
    if a.max_ratio is not None and (not math.isfinite(a.max_ratio) or not 0 <= a.max_ratio <= 1):
        ap.error("max-ratio must be finite and 0..1")
    if not a.viewports.strip() or not a.kinds.strip():
        ap.error("viewports and kinds must not be empty")
    if a.strict:
        a.threshold = 0

    records, failed = [], False
    for vp in a.viewports.split(","):
        vp = vp.strip()
        if not vp:
            continue
        for kind in [k.strip() for k in a.kinds.split(",") if k.strip()]:
            name = f"{a.prefix}-{vp}-{kind}"
            ref = os.path.join(a.root, a.ref, name + ".png")
            rep = os.path.join(a.root, a.rep, name + ".png")
            if not (os.path.exists(ref) and os.path.exists(rep)):
                records.append({"name": name, "missing": True, "ref": ref, "rep": rep})
                failed = True
                continue
            r = compare(ref, rep, os.path.join(a.root, a.out, name + "-diff.png"), a.threshold, a.bands)
            r["name"] = name
            r["pass"] = not r["sizeMismatch"] and (
                r["changedPixels"] == 0 if (a.strict or a.max_ratio is None) else r["changedRatio"] <= a.max_ratio)
            failed |= not r["pass"]
            records.append(r)

    if not records:
        ap.error("no screenshot pairs selected")
    report = os.path.join(a.root, a.out, "report.json")
    os.makedirs(os.path.dirname(report), exist_ok=True)
    with open(report, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    for r in records:
        if r.get("missing"):
            print(f"MISSING {r['name']}")
        else:
            print(f"{'PASS' if r['pass'] else 'FAIL'} {r['name']} ratio={r['changedRatio']} "
                  f"max={r['maxChannelDelta']} size={'MISMATCH ' + str(r['refSize']) + ' vs ' + str(r['repSize']) if r['sizeMismatch'] else 'ok'}")
    print(f"report: {report}")
    sys.exit(2 if failed else 0)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Slice a scroll-0 fullPage screenshot into per-section crops (original, clean-room helper).

Usage: slice_sections.py <full.png> <recon.json|outline.json> <out_dir>
Reads `outline` (list of {y,h,w,heading,tag,i}) from recon.json, or a bare list.
Handles devicePixelRatio > 1 by deriving scale from image width / viewport width.
Requires Pillow.
"""
import json, re, sys
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    img_path, meta_path, out_dir = sys.argv[1:]
    meta = json.load(open(meta_path))
    outline = meta["outline"] if isinstance(meta, dict) else meta
    vw = (meta.get("viewport", {}) or {}).get("w") if isinstance(meta, dict) else None
    img = Image.open(img_path)
    scale = img.width / (vw or max((s.get("w") or 0) for s in outline) or img.width)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for n, s in enumerate(outline):
        top, bot = max(0, int(s["y"] * scale)), min(img.height, int((s["y"] + s["h"]) * scale))
        if bot - top < 10:
            continue
        label = s.get("heading") or s.get("id") or s.get("cls") or s.get("tag") or "section"
        label = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:32] or "section"
        name = f"{n:02d}-{label}.png"
        img.crop((0, top, img.width, bot)).save(out / name)
        print(f"{name}\ty={s['y']}\th={s['h']}")


if __name__ == "__main__":
    main()

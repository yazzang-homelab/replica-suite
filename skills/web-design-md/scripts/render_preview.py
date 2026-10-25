#!/usr/bin/env python3
"""Render a glanceable HTML preview next to DESIGN.md (original, stdlib only).

Usage: render_preview.py DESIGN.md [-o DESIGN-preview.html]
Shows colour swatches (every hex in the doc with its table-row/line label), the font families
mentioned in the doc as live samples, and the raw markdown. The doc stays the source of truth: nothing is stored
outside it. Self-contained file, no network, no scripts.
"""
import argparse
import html
import os
import re


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("doc")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    text = open(a.doc, encoding="utf-8").read()
    out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.doc)), os.path.splitext(os.path.basename(a.doc))[0] + "-preview.html")

    swatches, seen = [], set()
    for line in text.splitlines():
        for h in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b", line):
            key = h.lower()
            if key in seen:
                continue
            seen.add(key)
            label = re.sub(r"[|*`#>-]+", " ", line.replace(h, "")).strip()[:60]
            swatches.append((h, label))
    fonts = []
    for m in re.finditer(r"font[- ]?family[^\n:]*:\s*`?([^`\n|;]+)", text, re.I):
        f = m.group(1).strip().strip("\"'")
        if f and f not in fonts:
            fonts.append(f)
    sw = "".join(
        f'<div class="sw"><div class="chip" style="background:{html.escape(h)}"></div><b>{html.escape(h)}</b><span>{html.escape(l)}</span></div>'
        for h, l in swatches)
    fs = "".join(f'<p style="font-family:{html.escape(f)}">{html.escape(f)} — The quick brown fox 0123456789</p>' for f in fonts[:8])
    page = f"""<!doctype html><meta charset="utf-8"><title>{html.escape(os.path.basename(a.doc))} preview</title>
<style>body{{font:14px system-ui;margin:2rem;max-width:1000px}}.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}}
.sw{{border:1px solid #ddd;border-radius:8px;overflow:hidden;font-size:12px}}.sw b,.sw span{{display:block;padding:2px 8px}}.chip{{height:56px}}
pre{{background:#f6f6f6;padding:1rem;overflow:auto;white-space:pre-wrap}}h2{{margin-top:2rem}}</style>
<h1>{html.escape(os.path.basename(a.doc))} — preview</h1><h2>Colours ({len(swatches)})</h2><div class="g">{sw}</div>
<h2>Typography samples</h2>{fs or '<p>No font-family lines found.</p>'}<h2>Source</h2><pre>{html.escape(text)}</pre>"""
    with open(out, "w", encoding="utf-8") as f:
        f.write(page)
    print(out)


if __name__ == "__main__":
    main()

# Command recipes

Paths assume `S=<plugin>/skills/web-verify-pixel/scripts` and a clone root `./site-clone/`.

## One-time setup (ask before installing)
```bash
npm ci --prefix "${CLAUDE_PLUGIN_ROOT}"                     # plugin-local browser dependency
# From the plugin root: npx playwright install chromium
# Linux without system libs: npx playwright install-deps chromium  (needs root/apt; ask first)
python3 -m pip install -r "${CLAUDE_PLUGIN_ROOT}/requirements.txt"  # active virtualenv
```
`pixel_diff.py` uses the shared Pillow PNG I/O in `lib/images.py`; it does not maintain its own decoder.
Pure-Python diff costs a few seconds per megapixel: for very tall pages diff `top` first, or
downscale only for triage (never for the pass/fail number).

## Layout
```
site-clone/
  reference/  <prefix>-<WxH>-top.png|full.png, <prefix>-runtime.json
  replica/    same names
  diff/       <prefix>-<WxH>-<kind>-diff.png, report.json
  .qa/        gate.json, rounds.md, server.log, notes
```

## Capture reference, serve replica, capture replica
```bash
node $S/capture_matrix.mjs --url=https://REF/ --out=site-clone/reference --prefix=site
(cd site-clone/app && python3 -m http.server 5180 --bind 127.0.0.1 &)      # static replica
# framework replica: use its own `npm run build && npm run start` and the printed port
node $S/capture_matrix.mjs --url=http://127.0.0.1:5180/ --out=site-clone/replica --prefix=site
```
Multi-page: repeat with a distinct `--prefix` per route (`home`, `pricing`).
Behind a user-supplied login: `--storage-state=path.json` (never commit it, never print cookies).

## Diff and gate
```bash
python3 $S/pixel_diff.py --root site-clone --prefix site --strict           # exact (mirrors)
python3 $S/pixel_diff.py --root site-clone --prefix site --max-ratio 0.005  # rebuilds
python3 <plugin>/skills/web-qa-independent/scripts/qa_gate.py \
  --diff site-clone/diff/report.json \
  --replica site-clone/replica/site-runtime.json \
  --ref site-clone/reference/site-runtime.json --max-ratio 0.005 --out site-clone/.qa/gate.json
```

## Extra flags
- `capture_matrix.mjs --freeze=0` to see live behaviour; `--prime=0` for pages where scrolling
  must not run (scroll-scrubbed canvas: capture initial state instead).
- `pixel_diff.py --viewports 1440x1000 --kinds top` to iterate fast on one breakpoint.
- `--threshold 16` ignores sub-perceptual per-channel deltas; keep default unless justified.

## Ad-hoc probes (run in page)
```js
// computed geometry for one selector on both sites, then diff the JSON
(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);
 return {r:[r.x,r.y,r.width,r.height].map(Math.round),font:c.font,ls:c.letterSpacing,color:c.color,bg:c.backgroundColor,pad:c.padding,gap:c.gap,radius:c.borderRadius}})('h1')
```

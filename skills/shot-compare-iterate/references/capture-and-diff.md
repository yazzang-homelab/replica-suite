# Capture conditions and diff details

## Why conditions matter
A screenshot is only evidence of width/DPR when the browser really runs at that viewport. Print `innerWidth`, `devicePixelRatio`, `documentElement.scrollWidth` with every capture. A plain `chromium --headless --window-size=390,844` can yield a different CSS `innerWidth`; use an emulated mobile context instead.

```js
// Resolve from a script in the plugin root; use an absolute file URL from other locations.
import { launchBrowser, settlePage } from './lib/browser.mjs';
const b = await launchBrowser({ headless: true });                     // channel: 'chrome' only when explicitly selected
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded' });
await settlePage(p, { timeoutMs: 15000 });
console.log(await p.evaluate(() => [innerWidth, devicePixelRatio, document.documentElement.scrollWidth]));
await p.screenshot({ path: 'tmp/shot/m1.png', fullPage: true });
await b.close(); // use try/finally around the interaction in executable scripts
```
Pages need `<meta name="viewport" content="width=device-width, initial-scale=1">` or mobile emulation reports 980.

## Comparing different DPRs
Target @2x 2880 wide vs render @1x 1440: `compare.mjs --align width` resizes the render to the target width (softer, but region-level numbers stay meaningful). For exact overlay render at `--scale` equal to the target DPR.

## Reading the numbers
- `globalMismatchPct` depends on tolerance and on text; treat it as a trend between rounds of the *same* comparison, never as "% fidelity" and never compare across pages.
- `heightDelta != 0`: some block above is taller/shorter - find the first band where mismatch starts.
- A single hot cell with the rest cold = local fix (asset, icon, shadow). A hot stripe across full width = spacing or container issue. Mismatch increasing downward = accumulated vertical drift.
- Backdrop blur, gradients, fonts: differences at 1x vs 2x are normal; use `--scale 1` for overlays.
- Thin borders look lighter after anti-aliasing; do not retune a border color on one pixel.

## Round log (tmp/shot/round-notes.md)
```
v2: hypothesis: container 1200 vs 1280 | change: --container token | result: bands 2-5 mismatch 18% -> 6% | regression: none
v3: ...
remaining: hero photo crop (asset), font substitute Inter vs target SF - accepted
```

## Interaction audit checklist (`shot.mjs --verify`)
Inert clickable-looking elements, missing `cursor:pointer`, no `:hover` rules, no `:focus-visible` rules. Fix each, then capture `--states` frames and compare visually (the target image rarely contains them; judge for consistency).

## Mobile-web audit pack
One run produces: full viewport shot at the real mobile size, per-section shots, DOM metrics JSON (viewport, scroll widths, section boxes, fixed/sticky overlays), a P0/P1/P2 list. Fix P0+P1 in one batch, re-audit once; avoid the slow screenshot -> one padding fix -> screenshot loop.

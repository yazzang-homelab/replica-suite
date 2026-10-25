# Section screenshot diff

Anchors: every major section has `data-section="<name>"`.

## Capture one audit pack per run
1. Full viewport at the real page width (mobile: emulated device).
2. A screenshot of each `[data-section]` (all of them for the first run, the 2-5 most important afterwards).
3. DOM metrics JSON: `innerWidth`, `documentElement.scrollWidth`, `body.scrollWidth`, bounding box of each section, grid column sizes, fixed/sticky overlays.
4. Prioritized repair list: P0 structure, P1 obvious visual/overflow, P2 polish/debt.

Playwright sketch (adapt names; run from the project):
```js
import { chromium } from 'playwright-core'
const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await p.goto(process.env.URL, { waitUntil: 'networkidle' })
await p.evaluate(() => document.fonts.ready)
const metrics = await p.evaluate(() => ({
  inner: innerWidth, scroll: document.documentElement.scrollWidth,
  sections: [...document.querySelectorAll('[data-section]')].map(e => ({ n: e.dataset.section, r: e.getBoundingClientRect().toJSON() })),
}))
for (const el of await p.$$('[data-section]')) await el.screenshot({ path: `tmp/shot/sec-${await el.getAttribute('data-section')}.png` })
console.log(JSON.stringify(metrics, null, 1)); await b.close()
```
Then compare each with its scaled source crop using `shot-compare-iterate/scripts/compare.mjs`.

## Layers
| Layer | Check |
|---|---|
| structure | order, regions present, primary actions visible |
| proportion | section width/alignment, shell vs inner split, heights, margins, first-screen density |
| style | type hierarchy, spacing rhythm, color/radius/shadow, button hierarchy, status colors |
| detail | media role, icon fidelity, badges/dividers/waves/ornaments, no distortion, card layer stack (base, chart/ring, metrics, dividers, glow, shadow), chip shapes |

Tolerated: anti-aliasing noise, small font-engine variance, documented deviations. Not tolerated: wrong section width/alignment, collapsed full-bleed shell, broken hierarchy, missing primary CTA, wrong media role, structural similarity passed off as high fidelity.

## After failure
Report failed section + layer, name the failure class (asset / structure / anatomy / token / verification), repair the biggest mismatch first, never regenerate the whole page, update the parity report. Max 3 rounds per section; then stop with root cause, what was tried, remaining mismatch.

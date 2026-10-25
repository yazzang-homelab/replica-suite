---
name: shot-compare-iterate
description: Render a built UI, screenshot it at the target viewport/DPR, compare it to the source image region by region, and iterate fixes until differences are cosmetic - with scripts for screenshots, state capture, interaction audit, diff heat maps and multi-viewport QA. Use for "스크린샷 비교", "픽셀 비교 반복 수정", "시안과 구현 차이 확인", "렌더링 비교 루프", "visual diff loop", "compare my render to the target image", "fix visual differences", "parity check".
---

# shot-compare-iterate - render -> compare -> fix loop

The engine behind every `shot-to-*` skill. A first draft is never done; the loop measures the gap the image could not give as numbers. Use after any build from `shot-to-web`, `shot-to-unocss`, `shot-to-rn` (web render) or on a Qt render image.

## When to use
After the first draft exists; whenever the user says it "doesn't match"; before declaring any screenshot clone done.

## Authorization gate
Only run against your own build and a reference image the user is entitled to use. Do not scrape or screenshot third-party live sites with this skill (use the web-* skills with permission checks for that).

## Setup (once)
```bash
npm ci --prefix "${CLAUDE_PLUGIN_ROOT}"
# From the plugin root: npx playwright install chromium
```
Bundled Chromium is the default. `shot.mjs --channel chrome` explicitly selects installed Chrome; no silent browser fallback. Shared `lib/browser.mjs` resolves dependencies from the plugin, independent of the target CWD. Font/image waits are bounded by `--timeout` (default 15000 ms), and navigation or stabilization errors fail rather than capturing an unready page. Scripts live in `scripts/` (credits: scripts/NOTICE.md).

## Loop
```
- [ ] A Fix the capture conditions (viewport, DPR, full-page, fonts loaded, animations frozen)
- [ ] B Render: node scripts/shot.mjs ...
- [ ] C Compare: compare.mjs numbers + look at side-by-side
- [ ] D List diffs by priority; fix the top 1-3 root causes
- [ ] E Re-render; keep only changes that shrink the gap
- [ ] F Stop rule met? -> states + responsive + report
```

### A Capture conditions
Match the target: CSS width = spec design width; `--scale 2` for crisp diffs (use `--scale 1` for exact overlay on a 1x target). For mobile web emulate a real device (width 390, height 844, DPR 2, touch) and print `innerWidth` - headless `--window-size` alone can report a different CSS width. Wait for fonts/images; animations frozen by default; do not change page/scroll/viewport during capture.

### B Render
```bash
node scripts/shot.mjs --in replica.html --out tmp/shot/v1.png --width 1440          # full page, 2x
node scripts/shot.mjs --url http://localhost:5173 --out tmp/shot/v1.png --width 390 --viewport-only
node scripts/shot.mjs --in replica.html --verify                                    # dead controls / missing hover+focus
node scripts/shot.mjs --in replica.html --out tmp/shot/s.png --states               # base + hover + focus frames
node scripts/shot.mjs --in replica.html --out tmp/shot/m.png --click '#tab-2'       # open a tab/modal first
```

### C Compare
```bash
node scripts/compare.mjs --target shot/inputs/target.png --render tmp/shot/v1.png --out tmp/shot/cmp-v1 --bands 12 --grid 6x8
```
Read the printed worst bands/cells, then open `side-by-side.png` (target | render | diff). The percentage **locates** regions; it is never reported as a "fidelity score". `heightDelta` != 0 means layout drift above the first mismatch - fix the earliest shift first. Also look at crops of the worst cell at display size: text, thin borders and logos need a real look.

### D Priority and root causes
1. Structure: missing/extra blocks, wrong column count or order.
2. Container width + alignment (consecutive blocks shifted the same way -> fix the parent).
3. Spacing rhythm (most common drift).
4. Typography: size, weight, line-height, wrapping (use real text for wrap decisions).
5. Color/contrast, gradients, overlays.
6. Polish: radius, shadow, borders, icon shape.
Never patch each block with offsets; adjust order: container -> fonts/wrap -> spacing -> asset crop -> decoration. Classify each miss as asset / structure / anatomy / token / verification; if CSS tweaks stop helping, the spec is under-specified: return to `shot-analyze` for that section.

### E Round discipline
Name the hypothesis, change one root cause group, re-render to `v2.png`, `v3.png`. Note gains and regressions in `tmp/shot/round-notes.md`. Batch-fix everything seen in one audit instead of one padding at a time. Max ~3 repair rounds per failing section; if stuck, record root cause, what was tried, remaining mismatch.

### F Stop rule
Stop when remaining differences are font rasterization, anti-aliasing, unseen content or documented accepted deviations. Then:
- **States:** hover, focus, open modal/menu, tab variants, dark mode.
- **Responsive:** repeat at 390 / 768 / 1024 / 1440 via `node scripts/capture_visual_qa.mjs --url http://localhost:5173 --out visual-qa/screenshots`; horizontal scroll = critical bug.
- **Optional pixel diff** for reference PNGs per viewport: `node scripts/compare_visual_qa.mjs --reference-dir visual-qa/reference --actual-dir visual-qa/screenshots --out visual-qa/diffs`.
- Severity labels in the report: **P0 structure** (blocks handoff), **P1 obvious visual/overflow**, **P2 polish/debt (recorded)**.

Tolerated: anti-aliasing, subpixel text shifts, documented deviations. Not tolerated: wrong width/alignment, broken hierarchy, missing primary CTA, wrong media role, structural-only similarity claimed as fidelity.

Details (mobile emulation snippet, DPR mismatch, reading the numbers, round log, audit pack): [references/capture-and-diff.md](references/capture-and-diff.md).

## Non-DOM targets
Qt/QML/native: render headlessly to PNG at design size x DPR, then run `compare.mjs` the same way (see `shot-to-qml`). RN: run Expo web at 390px, capture with `shot.mjs --url`, compare.

## Outputs
```
tmp/shot/v1.png v2.png ...    renders
tmp/shot/cmp-vN/              side-by-side.png diff.png report.json
tmp/shot/round-notes.md       hypotheses, changes, gains/regressions, remaining debt
visual-qa/                    multi-viewport screenshots + diffs (final QA)
```
Final report: viewports/DPR used, rounds run, remaining differences with cause, anything not verified.

## Sources
sevzq/screenshot-to-html (shot.mjs render step, rendered-state loop), onewave-ai/claude-skills (visual check order, responsiveness checks), fitoe/DesignToCode (section diff, mobile viewport evidence, repair policy, P0/P1/P2), oil-oil/draw-ui (baseline discipline, no percentage claims - reimplemented), vishnu-madhavan-git/9designer-skills (capture/compare QA scripts, benchmark rubric), ozaysahin/screenshot-to-qml (worst-region first, stop on stalled gain), Birkenpapier/ai-app-cloner (diff loop as engine, functional gate).

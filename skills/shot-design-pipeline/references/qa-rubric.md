# QA ledger and score

## Ledger (docs/QA_LEDGER.md) - at least 8 comparison points
| # | Area (copy / layout / type / palette / asset treatment / icons / spacing+container / responsive / interaction) | Mock-up evidence | Build evidence | Diff | Fix or accepted deviation |
Viewports: desktop ~1440, tablet ~768 (iPad portrait 1024x1366 when relevant), mobile ~390. Check hover, click, menu, form, tab/filter/carousel and scroll states shown in the design. If a reference dimension cannot be matched exactly, state it and test the nearest practical viewport. Link screenshots and diff images; still write the human-visible mismatch and the decision.

## Score each 0-5
| Category | 5 | 3 | 1 |
|---|---|---|---|
| Reference fidelity | layout, hierarchy, mood, palette, section order, hero composition match | recognisable, several drifts | generic redesign |
| Asset quality | clean, local, matched, layered correctly | some blurry/missing variants | placeholders, screenshot- or checkerboard-backed assets |
| Responsive | hierarchy preserved at all widths, no overflow/overlap | one viewport has issues | a viewport unusable |
| Accessibility | semantics, alt, labels, focus, contrast intentional | basics only | core controls inaccessible |
| Build reliability | install/build/dev work, no broken images, clean console | minor warnings | build fails or assets broken |
| QA completeness | >=8 points, viewports, interactions, repair notes | light ledger | none |

Targets: public showcase = every category >= 4.0 and no blockers; internal working build = overall >= 3.5 with blockers recorded. Never average away a blocker (failed build, unusable mobile, inaccessible primary nav/form, checkerboard-backed core asset).

## Repair order
1 build failures/broken images/console errors -> 2 unclean assets -> 3 composition drift -> 4 responsive failures -> 5 type and spacing drift -> 6 color/atmosphere -> 7 interaction gaps -> 8 missing QA documentation -> 9 deploy-readiness gaps.

## Breakpoint matrix
375x812 (hamburger, single column, targets >= 44px), 768x1024 (2-col, hybrid nav), 1024x768 (full nav, 3-col), 1440x900 (wide, centered container). Horizontal scroll (`scrollWidth > innerWidth`) is a critical bug. Run `shot-compare-iterate/scripts/capture_visual_qa.mjs` and `compare_visual_qa.mjs` for screenshots and diffs.

## Optional deploy-ready checklist
Production build passes; QA ledger and score exist; four viewports reviewed; interactions work; env vars documented; no secrets in repo; user explicitly asked for deployment and supplied/approved the account step.

---
name: app-parity-test
description: Verifies a clone against its spec and the original - test plan from flows, Playwright/e2e and console-clean route sweep, bug log by severity, weighted feature-parity score, colour-agnostic screenshot layout diff, iterative visual-diff loop and design review. Use for "클론 검증", "패리티 점수", "원본과 비교", "QA", "버그 찾기", "화면 비교", "test my clone", "how close is it to the original", "what's missing", "visual diff", "parity check", "is it shippable", after app-build.
---

# app-parity-test

Reads flows and S-IDs from `appclone/recon.md`, `features.csv`, the running clone, and reference screenshots. Writes `test-plan.md`, tests, `bugs.md`, `parity.md`, diff images. Verification is a loop (measure, compare, review, fix biggest, repeat), not a final pass.

## Clean-room / authorization gate
- **Test your clone, never the original.** No load-testing, fuzzing, scripting or hammering the original's servers. Using it by hand as a normal user is fine.
- Reference screenshots come only from public pages, the user's own account, or inputs the user supplied; they stay in `appclone/screens/` and are never shipped.
- Do not chase pixel parity with the original's colours; its exact look is its identity and changes at brand time. Layout, structure and behaviour parity are the goals (exception: user-owned site migration, where pixel parity ~95% is the bar).
- Report honest numbers: a clone at 62% is at 62%. A skipped check is a skip, never a pass.

## Workflow
1. **Test plan** ([references/test-plan.md](references/test-plan.md)): per flow F01.. write happy path, edge cases (empty/long/emoji input, double submit, two tabs, back/refresh mid-flow, slow/offline network, expired session, second user's data, time zones/DST, 390px width, keyboard-only, screen-reader labels) and negative cases (wrong password, declined card, permission denied, deleted record). Number cases `F01-H1`, `F01-E3`, `F01-N2`.
2. **Automate** with Playwright (or the project's e2e tool): one spec per flow against the local server with seed data; select by role/label, not CSS classes; every spec fails on console errors, `pageerror`, any 5xx, and runs an axe accessibility scan per screen. Add a **route sweep**: load every route once, assert zero console/page errors, screenshot each at 390 and 1440. Test the dev server and the production build (errors differ).
3. **Behavioural flows must assert post-action state** (renamed text survives reload, row gone after delete, card moved after drag). Per owned collection: one edit-existing flow, one delete flow, one flow per gesture in the spec's Interactions table; each interaction has a passing flow or a `cut: backend-only` note.
4. **Manual pass** for what cannot be automated (email arrival, real OAuth, payments end to end, visual glitches): drive the local clone with a browser tool and screenshot each step, or hand the user a checklist.
5. **Bugs** in `appclone/bugs.md` ([references/bug-report.md](references/bug-report.md)): id, severity S1 (data loss, security, wrong payments, core flow blocked) to S4 (cosmetic), exact steps, expected, actual, evidence. Only reproduced bugs; hunches go in a separate "to check" list.
6. **Fix loop**: S1/S2 first; write the failing test, fix, see it pass, keep the test; rerun the whole suite after each batch; record the fixing commit.
7. **Feature parity**: `python3 scripts/parity.py appclone/features.csv` (must 3 / should 2 / could 1, partial = half, `skip` and added features excluded; any must missing = not shippable). Add `--help` for JSON/visual options.
8. **Layout diff per key screen**, same viewport (1440x900, 390x844), same state: `python3 scripts/imgdiff.py appclone/screens/S07.png appclone/clone-screens/S07.png --out appclone/diffs/S07.png`. Default layout mode compares edge maps on a grid and ignores colour; `--mode pixel` is for clone-vs-clone regression only. Read the regions that differ in the original's coordinates. For moving content (carousels, clocks) capture twice or mask the region.
9. **Visual-diff loop (screenshot-derived clones)**: render -> screenshot -> diff -> fix -> repeat, budget 2-4 rounds per screen and per state (dark, modal, tab). Spacing, colour, font weight, radius, missing overlay layers and wrong stacking are the usual deltas. Screenshot inputs have estimated values; this loop is what corrects them.
10. **Design review** of each key screen at 390 and 1440 using [references/design-review.md](references/design-review.md): hard rejects first, then 7 scores; fix the highest-impact issue, rerun.
11. **Behaviour diff**: walk each flow in both apps; compare clicks to finish (fewer is a win), error handling, what is remembered, emails sent. Record `flow | original does | clone does | fix or keep`.
12. **Report** `appclone/parity.md`: overall score, feature score, layout score per screen, missing features in build order, behaviour diffs, verdict:
    - **not shippable**: any must-have missing or any open S1/S2
    - **shippable**: all must-haves done, feature score >= 80, no open S1/S2
    - **better than original**: shippable plus research fixes built (the goal; a straight copy has no reason to exist)

## Verification gates
Typecheck + build green; route sweep clean; e2e suite green; zero open S1/S2; parity script exit/verdict recorded; layout score per key screen recorded (match >= 90, close >= 75, partly >= 50); design review passes (no hard rejects, no score under 3, total >= 28/35).

## Outputs
`appclone/test-plan.md`, `e2e/` specs, `appclone/bugs.md`, `appclone/parity.md`, `appclone/diffs/*.png`, `appclone/clone-screens/`. End with the top five things to build next and the next skill (`app-build` for gaps, `app-brand-deploy` when shippable).

## References
- [test-plan.md](references/test-plan.md), [bug-report.md](references/bug-report.md), [design-review.md](references/design-review.md)
- scripts: `scripts/parity.py` (feature score, stdlib), `scripts/imgdiff.py` (layout/pixel diff, shared Pillow I/O in `lib/images.py`); no network. Install the plugin's Python requirements.

## Sources
Derived from: Jakeschincariol/replica-skill (test, diff; parity.py and imgdiff.py are MIT-licensed copies), thenavidm/remaster (verify stage, design critic bars), Birkenpapier/ai-app-cloner (functional gate before visuals, visual-diff loop, verify flows), boyang-hu/website-rebuild-skill (quantitative gates, self-baseline before blaming code, gates must not be produced by the thing they audit).

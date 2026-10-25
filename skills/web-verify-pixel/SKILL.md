---
name: web-verify-pixel
description: Prove a website clone matches its reference with a multi-breakpoint screenshot matrix, pixel diff, runtime health checks and an iterative auto-fix loop. Use for "픽셀 퍼펙트 검증", "스크린샷 비교", "클론 차이 찾아서 고쳐줘", "pixel diff", "visual regression", "does my clone match", "fix the differences until it matches".
---

# web-verify-pixel — measured fidelity, not eyeballing

Treat the live reference as truth. Every "matches" claim needs diff artifacts plus numbers.

## Authorization / clean-room gate
- Only capture sites the user owns, has permission to analyse, or public pages for internal
  comparison. No bypass of auth, paywalls, bot protection, rate limits. Use a session only if the
  user supplied it (`--storage-state`); never print or store cookies in reports.
- The replica under test must be a legitimate rebuild or a permitted mirror; this skill only
  measures, it never makes a copy "more exact" by pulling in extra proprietary assets.

## Inputs
Reference URL, replica URL (running locally), route list, extra breakpoints, accepted-dynamic
regions (video/canvas/ticker), target (`exact` for mirrors, else a ratio such as 0.5%).

## Workflow
1. **Preflight.** `node -v`, `python3 -V`, Playwright resolvable (`npm i -D playwright &&
   npx playwright install chromium`; ask before installing). Replica must answer HTTP 200.
   Read `references/fidelity-standards.md`.
2. **Layout.** Create `<clone>/{reference,replica,diff,.qa}` (see `references/command-recipes.md`).
3. **Capture reference** before touching the replica:
   `node scripts/capture_matrix.mjs --url=<ref> --out=<clone>/reference --prefix=<slug>`
   (viewports 1920/1440/1024/768/375 default, top+full PNG, prime scroll, animation freeze,
   console/HTTP/broken-image/overflow/canvas/font record). Add the site's real breakpoints.
4. **Capture replica** with identical flags into `replica/`.
5. **Diff:** `python3 scripts/pixel_diff.py --root <clone> --prefix <slug> [--strict | --max-ratio R]`.
   **Gate A:** no `MISSING`, no size mismatch, page heights equal. Fix those first.
6. **Read the overlays** (magenta = changed). Classify structural vs anti-alias noise using
   `worstBands`; never judge from the ratio alone.
7. **Auto-fix loop** (`references/autofix-loop.md`): one cause per round, section by section,
   re-capture + re-diff, log in `.qa/rounds.md`, max 8 rounds/section, stop if no progress twice.
   **Gate B:** every record passes the target or has a user-approved, documented residual.
8. **Dynamic media:** compare a controlled state (video at t=0, canvas at fixed timeline or
   masked) and verify the live behaviour separately; a live autoplay diff is not a layout failure.
   Canvas/WebGL parity beyond a still: hand off to `web-webgl`.
9. **Behaviour checks** the pixels cannot see: hover/focus, menus, tabs, carousels, sticky/pinned
   scenes in both scroll directions, forms, links between cloned routes — drive with real input.
10. **Hand to `web-qa-independent`** for the release verdict when the user wants independent QA
    or the clone is a deliverable. Otherwise run its `qa_gate.py` yourself for the mechanical gate.
11. **Report** only verified facts: viewports covered, per-record ratio/max delta, size/height
    equality, runtime findings, overlay paths, residual list with causes.

## Outputs
```
<clone>/reference/*.png, <slug>-runtime.json     <clone>/replica/*.png, <slug>-runtime.json
<clone>/diff/*-diff.png, report.json             <clone>/.qa/rounds.md, gate.json
```

## Do not
Claim completion without diff evidence; eyeball colours/spacing/fonts; substitute default fonts;
loosen thresholds or mask regions to turn red green; compare warm-cache replica to cold reference;
ignore mobile; treat a CSS-only freeze as freezing JS/canvas animation.

## References
- `references/fidelity-standards.md` — matrix, determinism rules, diff reading, thresholds, done.
- `references/autofix-loop.md` — loop protocol, triage order, cause->fix table.
- `references/command-recipes.md` — setup, capture/diff/gate commands, probes.
- `scripts/capture_matrix.mjs`, `scripts/pixel_diff.py` — original, tested.

## Sources
Derived from niuniu122/pixel-perfect-website-clone-skill (evidence layout, breakpoint matrix,
controlled-state diffs, definition of done; upstream has no license, so scripts are
reimplemented), KeiaiLab/webEmbedding (bounded-fidelity honesty, verification dimensions), and
Amanuel2x/clone-skill and JCodesMore/ai-website-cloner-template (compare-repair-repeat loop,
same-viewport/same-state discipline).

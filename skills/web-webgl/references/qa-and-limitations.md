# WebGL clone QA and limitations

## Required evidence
Source and local screenshots at identical viewport/state, side by side; production build result
(for framework wrappers); missing-asset count; local HTTP failures (`runtime-qa.mjs` httpErrors);
page and console errors; engine and canvas dimensions; primary interaction results; final P0/P1/P2 list.
A screenshot alone is not QA.

## Run
```bash
# from a dir where playwright is installed; local mirror served on :3100
node scripts/runtime-qa.mjs --url=http://127.0.0.1:3100/ --out=.qa/runtime --viewports=375x812,768x1024,1280x800,1920x1080
```
It writes `<WxH>.png` per viewport and `runtime-qa.json` with assertions: noPageErrors,
noConsoleErrors, noHttpErrors, canvasPresent, canvasHasArea (exit 1 if any fails). It auto-selects
the first child frame if the runtime sits in an iframe.
Extra manual checks: canvas is non-blank (read back with a tiny `drawImage` to a 2d canvas or compare
screenshots of the region), no `WebGL context lost`, GPU-less CI uses `--use-gl=swiftshader`.

## Severity
- P0: canvas never starts at a requested viewport, blank/black canvas, missing model/texture/wasm,
  page errors, build failure, wrong route/redirect.
- P1: wrong camera/lighting/typography/layout at one viewport, broken menu/CTA, replica-only 4xx.
- P2: frame-timing differences, residual external 3rd-party embeds disclosed, sub-pixel noise.

## Expected differences (grade separately)
Continuously running physics, particles, randomised layouts, video frames and real-time lighting
differ between captures taken at different milliseconds. Grade stable layout, camera, lighting,
texture, typography and behaviour separately from frame timing. Use fixed timeline positions
or masks for pixel diffs, then verify motion by observing a full cycle.

## Interaction checks for scroll/pointer scenes
Wheel/touch/keyboard (not `scrollTo`) because Lenis/ScrollSmoother attach to wheel; check both
directions; pointer parallax; resize mid-scene; tab hidden/visible resume; reduced-motion.

## Limitations to state in the report
- Runtime mirror = replayed captured frontend, not maintainable source.
- Backend/auth/payments/APIs/DB/DRM are not mirrored.
- Anti-bot or consent gates can serve a different bundle to automation; note the gate you hit, never bypass.
- GPU/driver differences change shader output slightly; compare same renderer on both sides.

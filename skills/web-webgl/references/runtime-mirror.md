# Runtime mirror: architecture and rules

Use when the page's visual truth lives in JavaScript + canvas (Three.js, raw WebGL, Rive, Pixi,
Babylon, GSAP-driven scroll scenes) and a DOM/screenshot rebuild flattens it.

## Detection
Probe after load and access walls, BEFORE scrolling or "reveal stabilisation" changes the scene
(`scripts/probe_engine.js`). Recommend mirroring when either holds:
- a canvas/host declares a known engine (`data-engine`, THREE/Rive/PIXI globals, engine script URLs), or
- the largest visible canvas covers >= 55% of the viewport and scripts are active.
Retry the probe for a few seconds: engines attach markers late. To learn 2d/webgl/webgl2 without
altering the scene, inject at init (`context.addInitScript`) a wrapper that records
`HTMLCanvasElement.prototype.getContext` calls; do not call `getContext` yourself afterward.

## Capture rules (`scripts/capture_runtime_mirror.mjs`)
- Record successful GET 200 responses: all same-origin plus external scripts, styles, fonts,
  images, media, XHR/fetch bodies, workers, wasm, models (`.glb/.gltf/.drc/.ktx2`), textures
  (`.hdr/.exr/.basis`), shaders, `.riv` files.
- Skip analytics/telemetry hosts, `data:`/`blob:`, non-GET. Cap per file (128 MiB) and total (768 MiB).
- Never store HTTP 206 fragments as files. Re-fetch complete media with validated `Range` requests:
  every `Content-Range` contiguous, final length equals the total, else discard.
- Same-origin resources live at their root-relative path so `fetch('/models/a.glb')` keeps working.
  Third-party under `__ext/<host>/<path>`; query strings hashed into the filename.
- Settle window of ~10-15 s without scrolling; scroll-scrubbed scenes are captured at initial state.

## Text rewriting
The helper rewrites observed HTML src/href/poster/srcset, CSS url()/@import and static JS
import/export references using each resource's source URL as the base. Query-specific files
receive distinct local names. It then replaces captured absolute URLs in text resources.
The lightweight rewriting is not a complete HTML/CSS/JS parser: inspect its results. Dynamic
import(), computed fetch URLs, base tags, inline style attributes and relative JSON/SVG references
need separate investigation. Review `unresolvedRefs` and `skipped` in the manifest; a successful
capture does not prove offline replay. Test with the original server unreachable.
Use a new or empty output directory; symlinks and nonempty directories are rejected.
Strip analytics tags manually when they remain. If the site uses a client router and the mirror
is served from a different path, inject before any script
`<script>history.replaceState(null,"","/original/route")</script>`.

## Serving
Static server over `<out>/site` (`python3 -m http.server 3100 -d site`, or the project's server).
Headers matter for wasm (`application/wasm`), workers, and `SharedArrayBuffer` (COOP/COEP) — if the
reference sends them, replicate. For framework apps, put files under `public/` and render the
runtime document in a full-viewport iframe at `/__runtime/index.html`; state in code and docs that
the iframe is the runtime boundary.

## What stays external (never pretend otherwise)
auth/sessions, payments, private/stateful APIs, databases, third-party maps/video/analytics/embeds,
server-side mutations, DRM/protected media. List each as external in the delivery notes.

## Mirror vs clean-room rebuild
| | Runtime mirror | Clean-room rebuild |
|---|---|---|
| Fidelity | highest | depends on effort; shaders/camera/easing must be re-authored |
| Editable | minified, hard | yes |
| Rights | replays owner's code/assets: personal study/testing/permitted use only | needs owned or licensed assets |
| Use when | user owns the site / has permission / needs a faithful test fixture | user needs a product they can ship |
For a shippable product build the scene yourself from behaviour/spec: measure camera FOV/position,
lights, material parameters, easing, scroll mapping; use owned/licensed models and textures
(three.js + GSAP ScrollTrigger / rive-runtime). Compare with `web-verify-pixel` in a controlled state.

## Clean-room rebuild measurements (when not mirroring)
Canvas size/DPR and resize behaviour; renderer settings (antialias, tone mapping, colour space);
camera type/FOV/near/far and path vs scroll progress; lights; material params; post-processing;
timeline duration/easing; pointer reactivity; loader/intro sequence; fallback for no-WebGL.
Record them in `docs/scene-spec.md`; implement from that spec only.

---
name: web-webgl
description: Clone or test a WebGL / Three.js / Rive / canvas-heavy / scroll-scrubbed website by detecting the runtime, mirroring its resources locally (models, textures, wasm, workers, shaders), serving it, and running multi-viewport runtime QA. Use for "WebGL 사이트 복제", "Three.js 3D 사이트 클론", "캔버스 애니메이션 그대로", "Rive 애니메이션", "runtime mirror", "my screenshot clone lost the 3D scene".
---

# web-webgl — canvas runtime mirroring and QA

Use when ordinary DOM/screenshot cloning loses the point of the page: 3D scenes, shaders, canvas
animation, `.riv` files, scroll-driven camera paths. Decide first whether you are making a
**runtime mirror** (replay captured frontend) or a **clean-room rebuild** (author your own scene),
and say which one in every report.

## Mode and clean-room boundary
- Distinguish **runtime mirror** (replaying captured frontend code/models/textures/wasm locally for inspection or fixture testing) from **clean-room rebuild** (re-authoring the scene from measured behaviour with your own or project assets; see `references/runtime-mirror.md`).
- Do not commit captured runtime directories to shared repos unless requested; commit tooling and specs.

## Workflow
1. **Reference first.** Screenshot the reference at 1440x900 and 390x844; note any consent/access
   wall (record it, do not bypass).
2. **Probe.** Run `scripts/probe_engine.js` in the page after it settles (before scrolling). Read
   `runtimeMirrorRecommended`, engine globals, canvas coverage, asset counts (models, textures,
   wasm, riv, shaders, video). Gate 1: canvas exists with real area, or stop and use `web-capture`.
3. **Choose path** (table in `references/runtime-mirror.md`): runtime mirror (fidelity
   or test fixture) vs clean-room rebuild (editable source). If DOM carries most visuals, use the normal
   web-capture -> web-build-parallel pipeline instead.
4. **Mirror path.** `npm i -D playwright && npx playwright install chromium` (ask first), then
   `node scripts/capture_runtime_mirror.mjs --url=<url> --out=./mirror --settle-ms=12000`. Gate 2:
   manifest has the entry document, wasm/model/texture resources present, `skipped` list reviewed
   (206 fragments -> complete via validated ranges; caps; blocked analytics).
   Use a new or empty real output directory; existing files and symlink outputs are refused. Review `unresolvedRefs` and replay with the source server unavailable before claiming a local mirror works.
5. **Serve** `./mirror/site` on localhost (`python3 -m http.server 3100 -d mirror/site`); fix
   MIME/headers (wasm, COOP/COEP) when the reference had them. For a framework app wrap it in a
   full-viewport iframe at `/__runtime/index.html` and document the boundary.
6. **Runtime QA.** `node scripts/runtime-qa.mjs --url=http://127.0.0.1:3100/ --out=.qa/runtime
   --viewports=375x812,768x1024,1280x800,1920x1080`. Gate 3: all assertions true at every viewport.
7. **Side-by-side.** Equal-size reference and replica screenshots together; compare stable layout,
   camera, lighting, textures, typography. For pixel numbers use `web-verify-pixel` in a controlled
   state (fixed timeline / masked canvas); grade frame-timing noise separately.
8. **Interactions.** Real wheel/touch/keyboard (not `scrollTo`), both scroll directions, menus,
   CTAs, product selectors, resize, tab hide/show. Record failures as P0/P1/P2
   (`references/qa-and-limitations.md`).
9. **Clean-room path.** Write `docs/scene-spec.md` from measurements (renderer, camera/FOV, lights,
   materials, timeline, scroll mapping, pointer response, loader, no-WebGL fallback), build with
   three.js/GSAP/rive-runtime and owned assets, then run steps 6-8 against it.
10. **Report:** mode (mirror/rebuild), resource count and bytes, missing assets, viewport results,
    interaction results, remaining external dependencies (auth, APIs, payments, 3rd-party embeds),
    editability statement, P0/P1/P2 list. For a final verdict hand to `web-qa-independent`.

## Outputs
```
mirror/site/…  mirror/manifest.json     .qa/runtime/<WxH>.png, runtime-qa.json
docs/scene-spec.md (rebuild path)        .qa/findings.md (P0/P1/P2)
```

## Rules
Probe before scrolling; never store partial media; never call a mirror "clean" or "editable";
list every external dependency; no analytics in the replica; state limitations of GPU/bot gates.

## References
- `references/runtime-mirror.md` — detection, capture, rewriting, serving, mirror vs rebuild, spec checklist.
- `references/qa-and-limitations.md` — evidence, severity, expected differences, limits.
- `scripts/probe_engine.js`, `scripts/capture_runtime_mirror.mjs` (original),
  `scripts/runtime-qa.mjs` (copied from upstream, MIT, header credits commit 93d025b).

## Sources
Derived from xintongw431-arch/webgl-runtime-cloner-skill (runtime-mirror detection/capture/rewrite
rules, runtime-qa script, QA gates and limitations; MIT) with the motion-driver and "scroll-driven
click imitation is a different product" guidance from JCodesMore/ai-website-cloner-template
(Framer/motion reference) and fidelity expectations from niuniu122/pixel-perfect-website-clone-skill.

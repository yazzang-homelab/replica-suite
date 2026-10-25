---
name: web-firecrawl-analyze
description: Analyze a live website for cloning using Firecrawl (sitemap map + rendered scrape) plus Playwright (computed styles, animations, assets, screenshots) and produce a research pack with page brief, tokens, motion and asset manifests for builders. Use for "사이트 구조 분석", "파이어크롤로 사이트 맵 뜨고 분석", "클론 전에 리서치", "Firecrawl Playwright analysis", "analyze this site before cloning", "reverse-engineer page structure and animations".
---

# web-firecrawl-analyze — research pack before building

Produces evidence, not code. Output lets builders (`web-extract-styles`, `web-build-parallel`,
`web-mirror-rebrand`) work without reopening the site, and lets `web-verify-pixel` compare later.

## Clean-room and hygiene gate
- Record the scope and target in `page-brief.md`.
- Analysis captures facts about layout, tokens, and behaviour. Hand off to builders with a clean-room note: rebuild from behaviour/spec, and list assets/copy/brand that need replacement when rebranding.
- Never write API keys or sessions into files; redact cookies/headers in notes.

## Workflow
1. **Parse the ask:** source URL(s), slug (`<host>` minus TLD by default), pages in scope, whether
   a client/brand swap follows. Existing `docs/research/<slug>/` -> ask overwrite vs `-2`.
2. **Tool check** (`references/mcp-setup.md`): Playwright MCP/browser is mandatory; Firecrawl is
   optional (degrade gracefully, tell the user). Gate 1: tools confirmed connected.
3. **Scout.** `firecrawl_map` (or sitemap.xml + nav crawl) -> report "found N pages: top 10", agree
   scope (default: `/` plus obvious key pages). Run the routing
   preflight in `references/routing-and-handoff.md` (prefer exposed embed/source over rebuild).
4. **Render like a user.** Navigate at 1440x900; wait for fonts; scroll in ~60% viewport steps with
   pauses to trigger lazy media and IntersectionObserver reveals; return to top; take the master
   full-page screenshot. Repeat at 768x1024 and 390x844. Gate 2.
5. **Scrape.** Firecrawl `html`+`rawHtml`+`markdown`, `onlyMainContent:false`, `waitFor>=3000`
   into `source/<page>.*`; also save Playwright's rendered DOM as `*.rendered.html` (browser DOM wins
   for visuals; markdown wins for clean copy).
6. **Tokens.** Run `web-design-md/scripts/extract_design_evidence.js` (or the host's
   equivalent) for variables, `@font-face`, `@keyframes` verbatim, type scale, spacing/radius/shadow/
   gradient scales, breakpoints -> `tokens.json`. Gate 3: nothing truncated.
7. **Inventory + motion.** Run `scripts/inventory_page.js` (assets, libs, hooks, running animations,
   sticky layers, tagged sections). Then observe: scroll slowly with real input and screenshot at
   intervals, hover key controls before/after, play carousels/tabs, note driver
   (scroll/click/hover/time) and measured duration/easing -> `motion-manifest.json`. Gate 4.
8. **Per-section shots.** For each viewport, scroll each `data-clone-idx` section into view and save
   `screenshots/<vp>/section-<i>.png` plus alternate states.
9. **Assets.** `python3 scripts/download_assets.py --inventory assets-manifest.json --dest public/sites/<slug>
   --referer <page url>`; review `assets-map.json` — a ".png" may be AVIF/HTML-error; failures are
   listed, not ignored. Gate 5. Hotlinking back to the source is disclosed, not default.
10. **Brief.** Write `page-brief.md` + `route-map.md` per `references/analysis-artifacts.md`; list
    gated/unreachable items in `open-questions.md`. Gate 6: could an unfamiliar builder start now?
11. **Handoff.** Name the next skill (`web-extract-styles` for tokens->CSS, `web-build-parallel` for
    sections, `web-webgl` if a canvas runtime dominates, `web-design-md` if only documentation is
    wanted) and the shared-file owners. Report page count, artifacts, gaps.

## Outputs
`docs/research/<slug>/{page-brief.md,route-map.md,tokens.json,motion-manifest.json,
assets-manifest.json,assets-map.json,open-questions.md,source/,screenshots/}`; assets under
`public/sites/<slug>/`. Layout details: `references/analysis-artifacts.md`.

## Rules
A large DOM dump is not analysis; look at the page. Distinguish scroll/click/hover/time drivers
(a click imitation of a scroll scene is a different product). Vary viewport width including wider
than the design. Read declared values rather than inferring from one rendering. No Playwright ->
stop, do not fake it from static HTML.

## References
- `references/mcp-setup.md` — Playwright/Firecrawl setup, call settings, fallbacks.
- `references/analysis-artifacts.md` — file layout, brief and manifest schemas, quality gates.
- `references/routing-and-handoff.md` — source-first routing, routing preflight, build handoff.
- `scripts/inventory_page.js`, `scripts/download_assets.py` (original, tested).

## Sources
Derived from Amanuel2x/clone-skill (Playwright + Firecrawl MCP prerequisites, map/scrape/priming-
scroll/token/motion/asset capture stages; MIT), KeiaiLab/webEmbedding (source-first routing,
routing, needs-session/blocked statuses; MIT), and JCodesMore/
ai-website-cloner-template (page brief, route map, state-driver evidence, asset provenance and
format verification, build-order handoff; MIT).

# Source-first routing and build handoff

## Prefer, in order (webEmbedding-style)
1. **Direct reuse** of an owner-exposed route: the page is frameable/embeddable and the user is
   allowed to embed it (check `X-Frame-Options`, CSP `frame-ancestors`, owner intent). No rebuild.
2. **Original export / preview / remix / source** supplied by the owner (Webflow/Framer export,
   repo, design file).
3. **Bounded rebuild** from captured evidence (this pipeline), reported with measured fidelity.
4. **Visual fallback** for canvas/native-like surfaces (see `web-webgl`), labelled approximation.
Never present 3 or 4 as "exact". Frame-blocked, login-gated or app-gated pages -> record
`needs-session` / `manual-review` / `blocked`; do not fake private views.

## Permission and licence preflight (record in the brief)
Owned or explicit permission · intentionally exposed embed/preview · licence evidence · internal
review decision. "All rights reserved" with no permission -> stop at analysis; produce a structural
and design-language study (`web-design-md`) instead of reusable output. Record whether robots/ToS
were reviewed. Never accept `file://` or non-http(s) inputs; never use session artifacts without the
user supplying them; redact cookies, auth headers, tokens in HAR/network notes.

## Handoff contract to builders (web-extract-styles, web-build-parallel, web-mirror-rebrand)
Provide: route map, page-brief per page, tokens.json, motion-manifest.json, assets-map.json with
verified local files, labelled screenshots per viewport/state, list of shared files and who owns them
(fonts/globals/layout first, sections after). Builders run `web-verify-pixel` per section.

## Build-order guidance (from template workflows)
Foundation first (fonts, global CSS variables from tokens, layout width, shared components with all
observed states), then sections in parallel with explicit file ownership, then integration + project
check (build/lint/typecheck), then compare/repair loop. Keep one app per source origin unless the
user wants a combined app with distinct route prefixes. Preserve source pathnames for multi-page.
Query/fragment variants are states of one route.

## Stack choice
Match the source's behaviour with the smallest stack: static HTML/CSS/JS for simple pages;
Next.js/React + Tailwind or CSS variables for component logic; GSAP/ScrollTrigger for pinned and
scrubbed scenes; Motion/Framer for component enter/gesture; Lenis only when the source smooth-scrolls.
Use the exact fonts (self-host with the observed weights); icons from the source SVGs, not a
look-alike library.

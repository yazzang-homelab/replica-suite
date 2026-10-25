# Analysis artifacts

```
docs/research/<site-slug>/
  page-brief.md            one compact brief per page (below)
  route-map.md             source URL -> local route -> owning files
  tokens.json              declared + observed design tokens (web-extract-styles consumes this)
  motion-manifest.json     per animated element: trigger, deltas, duration, easing, stagger, library
  assets-manifest.json     inventory_page.js output (images/backgrounds/videos/fonts/sprites)
  assets-map.json          download_assets.py output: source URL -> local path, sniffed format, status
  source/<page>.html       Firecrawl html + rawHtml;  <page>.rendered.html = Playwright outerHTML
  source/<page>.md         Firecrawl markdown (copy reference text)
  screenshots/<vp>/overview.png, section-<i>.png     labelled by viewport, scroll, state
  open-questions.md        gated, unreachable, uncertain items
```

## page-brief.md (compact; add section briefs only when builders need them)
1. Purpose, type (marketing/docs/app/commerce), framework fingerprint (Next/Nuxt/Webflow/Framer/WP).
2. Section order table: idx | tag/id | y | height | layout (flex/grid cols, gap) | bg | headline.
3. Typography by role (family, weight, size/line-height, letter-spacing) and the font files really loaded.
4. Layout measurements: container max-width, gutters, columns, breakpoint list, what changes at each.
5. Interaction inventory: driver (scroll/click/hover/time) -> target -> result -> timing/easing.
6. Asset mapping: asset | where used | rendered size | crop/fit | local path.
7. Page-wide scripts: smooth scroll (Lenis), snap, cursor follower, page transitions.
8. Out-of-scope links and external dependencies (forms, checkout, APIs, embeds).
9. Evidence gaps.

## motion-manifest.json entry
```json
{"selector":"section[data-clone-idx=\"3\"] h2","driver":"scroll-reveal","library":"gsap+ScrollTrigger",
 "from":{"opacity":0,"y":24},"to":{"opacity":1,"y":0},"duration":0.6,"easing":"cubic-bezier(.22,1,.36,1)",
 "stagger":0.08,"start":"top 80%","reverse":true,"evidence":"screenshots/1440/reveal-3-a.png"}
```

## Quality gates
- G1 Tool check: Playwright connected (Firecrawl optional) and noted in the brief.
- G2 Render check: fonts ready, priming scroll done, full-page + per-section shots exist for 3 viewports.
- G3 Token check: tokens.json has CSS variables, @font-face, @keyframes verbatim, type scale, spacing/radius/shadow scales.
- G4 Motion check: libs detected, each observed animation has trigger + measured timing.
- G5 Asset check: every asset has a verified format/dimensions; failures listed, not ignored.
- G6 Brief check: a builder who never saw the site could start from `page-brief.md` + artifacts.

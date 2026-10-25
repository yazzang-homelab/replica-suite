# Fidelity standards for web clone verification

## Capture matrix (default)
| Viewport | Why |
|---|---|
| 1920x1000 | wide desktop; reveals max-width caps and centered gutters |
| 1440x1000 | canonical desktop |
| 1024x1000 | tablet landscape / small laptop; common layout switch |
| 768x1000 | tablet portrait |
| 375x812 | phone |

Add the site's own breakpoints (from `@media` conditions found by web-extract-styles /
web-design-md) and one width narrower or wider than each switch (e.g. 1279 and 1281 when a
rule says `min-width:1280px`). A scaled desktop screenshot is not a mobile reference.

Each viewport yields `top` (first viewport) and `full` (full page) PNGs plus a runtime-health
record. Same flags for reference and replica, always.

## Make comparisons deterministic (otherwise diffs are noise)
- Prime once: scroll through the page to trigger lazy images, IntersectionObserver reveals,
  font loading; return to top; await `document.fonts.ready`.
- Freeze: disable CSS animation/transition, pause every `<video>` at `currentTime=0`, hide caret.
  Scripted/JS-driven animation (GSAP, canvas) is NOT stopped by CSS: set a fixed timeline
  position, stub `requestAnimationFrame`/`Date.now` on the replica, or mask the
  region and verify it separately (see web-webgl).
- Same browser build, same `deviceScaleFactor=1`, same fonts installed, same locale/timezone.
- Mask or document truly live content: clocks, tickers, ads, randomised hero, cookie banners
  (dismiss identically on both sides), A/B variants.
- Never compare a warmed-cache replica to a cold reference: use fresh contexts.

## Reading a diff
- Magenta = changed pixels over a dimmed reference. `worstBands` gives vertical regions.
- Big solid blocks: structure (position, size, asset, colour, missing section).
- 1px halos on text/edges: anti-aliasing or sub-pixel font metrics. Check font files first.
- A uniform vertical shift that grows downward: one earlier element has the wrong height
  (line-height, image aspect ratio, margin collapse) - fix the first band, re-diff.
- Ratio alone proves nothing: a 0.2% ratio can be a missing logo. Open the overlay.
- Size mismatch (page height differs) always precedes pixel work.

## Thresholds
| Clone type | changedPixels target |
|---|---|
| Mirrored runtime / static copy | 0 in controlled state |
| Manual rebuild, text/layout site | <= 0.5% per viewport, no structural blocks |
| Rebuild with live video/canvas | controlled-state diff on non-media regions <= 0.5%; media region verified by frame check |
Any non-zero result you accept must be written down with its cause and user approval.

## Runtime/health checks (replica must be at least as clean as reference)
console errors, uncaught page errors, HTTP >= 400, broken `<img>` (`complete && naturalWidth>0`),
horizontal overflow, canvas present and non-zero area, video `readyState`, fonts actually loaded
(compare family+weight lists), page `scrollHeight` equal to reference.

## Interaction/motion checks (pixels do not cover these)
Hover/focus states, menu/accordion/tab/carousel boundaries, sticky/pinned scenes scrolled
both directions, smooth-scroll libraries (Lenis class on `html`), form validation messages,
route links between cloned pages. Drive with real input events (wheel, keyboard, pointer);
`scrollTo()` bypasses smooth-scroll and wheel-bound behaviour.

## Definition of done
All required viewports captured on both sides; diffs within target or documented; heights and
sizes equal; runtime checks clean (or identical upstream); interactions exercised; evidence paths
and numbers reported. Never claim "pixel-perfect" without them.

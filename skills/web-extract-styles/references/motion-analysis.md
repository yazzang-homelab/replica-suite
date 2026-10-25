# Motion and interaction analysis

## Decision tree (stop when explained)
1. **CSS static grep** (free): `grep -nE 'animation-timeline|view-timeline|scroll-timeline|@keyframes|scroll-snap|position:\s*sticky' source/css/*.css`.
   - `animation-timeline: view()/scroll()` => native scroll-driven CSS: copy keyframes and `animation-range` verbatim; no JS.
2. **Runtime inventory**: `scripts/animation-inventory.js`. `ViewTimeline/ScrollTimeline` = scroll-driven; `DocumentTimeline` = time-driven. Record keyframes, delay (stagger => sort by delay to get order), easing, iterations, per-element CSS variables (`--parallax-from`).
3. **Mutation watch + real wheel scroll**: observe `class/style/src` mutations on body subtree, wheel the full page in 400px steps. Zero mutations => pure CSS (sticky/backgrounds). Many class flips => JS state machine; list which classes flip at which scrollY.
4. **Multi-depth sampling** for fixed/sticky state machines (floating bars, collapsing headers): dump the whole subtree (rect, opacity, radius, bg, shadow) at depths such as 0/500/1500/3300/max, then back up. Diff snapshots; shape-shifting is invisible to position-only checks.
5. **Library detection**: `.lenis`, `[data-scroll-container]`, `window.gsap/ScrollTrigger`, `THREE`, Lottie, `<canvas>`. For library effects read the config object in the downloaded chunk (grep for a selector or ease name) rather than guessing durations.

## What to record per behaviour
Trigger (scroll px / IO ratio+rootMargin / click / hover / timer) - State A - State B - transition (duration, easing, properties) - mechanism (CSS, IO, scroll listener, GSAP, WAAPI) - reverse path.

## Common patterns and pitfalls
- Header shrinks/changes background after threshold; if height changes it fights scroll anchoring - plan a constant-height placeholder + fixed inner, or `overflow-anchor: none` with hysteresis.
- Sidebar/tab that auto-switches while content scrolls = IntersectionObserver, not click handlers.
- Curtain-reveal and sticky stacks depend on parent scope: record the parent chain.
- Marquee/motion-path loops: normalise to loop phase 0 before sampling or numbers differ per run.
- Entrance stagger: record `animation-delay` ordering, not screenshots.
- Scalloped/stamp edges: solid-side SVG with 1px overlap; SVG masks need `preserveAspectRatio="none"`.
- Media assets carry baked margins (matte, shadow padding); position by visual anchor, not rect arithmetic.
- Flex text truncation needs `min-width:0` on children.
- If a background tab never fires scroll/IO/rAF, dispatch `scroll` manually and document the limitation instead of declaring the effect absent.

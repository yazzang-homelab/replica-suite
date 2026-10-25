# Interaction, states, responsive

## Baseline (always)
```css
.ix{cursor:pointer;transition:transform .14s ease,background-color .14s,border-color .14s,opacity .14s}
.ix:hover{background-color:color-mix(in srgb,currentColor 8%,transparent)}
.ix:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.ix:active{transform:translateY(1px) scale(.985)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
```
- Real elements only: `<button type="button">`, `<a href>`, `<input>` with `<label>`; icon-only buttons get `aria-label`.
- Resting look never changes; feedback is added on top of a render that already matches.

## Functional behaviour (only when the image implies it)
| Seen | Do |
|---|---|
| tabs / segmented / filter | switch visible panel; `role="tablist"` + `aria-selected` |
| accordion / FAQ | toggle with `<details>` or button+`aria-expanded` |
| modal / menu / dropdown | open/close, Esc + backdrop dismiss, focus returns to trigger |
| mobile multi-screen app (web) | state-driven screen swap inside the 390px frame |
| in-page nav | smooth-scroll (respect reduced motion) |
| carousel / slider | scroll-snap or pointer-drag with velocity snap; no library needed |
| frozen dates/counters | compute from `new Date()`, mark today, make cells selectable |

## Tactile depth without libraries
Pointer drag primitive: `pointerdown` capture -> track x -> on `pointerup` snap to nearest slide using velocity; CSS `scroll-snap-type:x mandatory` covers most galleries; like/heart "pop" = 250ms keyframe scale 1 -> 1.25 -> 1. Entrance animations / scroll-jacking are NOT in a screenshot: add only on explicit request (then use a motion lib, honor reduced motion, verify a settled frame).

## Audit (what to verify, tooling in shot-compare-iterate)
- Dead controls: clickable-looking elements that are not interactive elements.
- Missing `:hover`/`:focus-visible`.
- Capture states: base, hover, focus, open modal/tab via `shot.mjs --hover/--focus/--click/--states`.

## Responsive
- Build fluid at the design width, then: 1024 -> 768 -> 390. Columns reduce 4->2->1; nav -> menu button; sidebars -> drawer; type via `clamp()`.
- Checks: `document.documentElement.scrollWidth <= innerWidth`; targets >= 44px; no text clipping; images keep ratio (`aspect-ratio`).
- If the screenshot is mobile, build mobile first and let desktop widen the container (do not invent a desktop layout you cannot see; center the 390-ish column or ask).

## Accessibility
Alt text for content images, empty alt for decoration; label every input; visible focus; contrast >= 4.5:1 for body text; landmarks (`header nav main footer`); never remove outlines without a replacement.

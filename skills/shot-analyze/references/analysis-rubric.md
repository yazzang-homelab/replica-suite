# Analysis rubric

Derive **relationships and tokens**, not coordinates. Scan global -> local.

## Layout
- Page container max-width; which bands are full-bleed; alignment (centered vs left).
- Columns per section (1/2/3/4-up, asymmetric like 1.04fr/.96fr); where a grid snaps.
- Vertical rhythm: section padding vs component gaps; first-screen density.
- Persistent chrome: top nav, side rail, bottom tab bar, floating buttons, sticky headers.

## Color (never trust a single pixel)
- Tokens: `bg surface surface-2 ink muted line brand accent danger ok`.
- Gradients: angle + 2-4 stops; overlays on photos; text at partial opacity (e.g. 60% white).
- Dark vs light theme; contrast level. Check body text >= 4.5:1; if the source fails it, note it as source behaviour.
- A scale from one brand color (12 steps keeping hue, lightness ~98% -> ~15%) is a *derived* token set: label it `derived`, not `measured`.

## Typography
| Look | Closest open fonts (examples) |
|---|---|
| neutral sans | Inter, Manrope, Public Sans |
| geometric sans | Poppins, Outfit, Plus Jakarta Sans |
| humanist | Source Sans 3, Nunito |
| serif / display | Playfair Display, Instrument Serif |
| mono | JetBrains Mono, IBM Plex Mono |
| Korean | Pretendard, Noto Sans KR |
- Scale: read the ratio hero/title/body/caption and snap to clean steps (e.g. 12/14/16/20/32/48). A modular ratio (1.2 minor third, 1.25 major third, 1.333 perfect fourth) is a fine fit when steps look geometric.
- Display type is often tight (-0.02 to -0.04em); headings line-height 1.0-1.2, body 1.5-1.7.
- Proprietary font? Pick the closest open face, say "substitute", never write the commercial name into CSS as if installed.

## Surfaces
- Radius family (e.g. 8/12/20/pill). Shadow depth (flat / soft / raised). Borders (often 1px at ~8-12% ink or white).
- Icon set guess (Lucide / Heroicons / Tabler / Material): stroke vs fill, stroke weight, size tokens, container shape.

## Components
- Anatomy list per component; repeated units -> one component + data array.
- Sizes of controls (button height, input height, tab bar height, hit targets >= 44px on touch).
- Visible states + assumed states.

## Content
- Verbatim text, including superscripts, units, currencies, date formats, empty/placeholder strings.
- Dates and counters that look "frozen" (today, 3 min ago) -> compute them at runtime in code.

## Executable per-section contract (use when fidelity must be high)
For each major section record: order, height or density (e.g. "2.5 cards visible"), anatomy, asset role (photo / css gradient / svg / icon / html text), token targets, **must-not-substitute** (e.g. "do not replace a populated list with an empty-state card", "do not turn a form into a dashboard"), and a pass criterion ("same internal layer order", "same first-screen density"). If an implementation keeps looking "similar but not restored", the cause is almost always an under-specified section contract, not CSS: stop editing styles and enrich the contract.

## Failure patterns -> what was missed
| Symptom | Missed in analysis |
|---|---|
| looks like a redesign | asset class, must-not-substitute |
| content right, feel wrong | component anatomy |
| too sparse / too loose | first-screen density, heights |
| CSS tweaks do not help | structure mismatch - re-read the image |
| wrong visual language | tokens, shadow/radius, image kind |

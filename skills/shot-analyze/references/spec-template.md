# shot/spec.md template

```markdown
# <Name> - build spec
- Source: <files> | Rights basis: <owned / licensed / public-behaviour-only>
- Target: <html | react | vue | svelte | unocss | rn | qml> | Project conventions read: <yes/no, which>
- Canvas: image <W>x<H>, DPR <n>, CSS design width <px>, scale <x>, second check width <px>

## Tokens   (m = measured, e = estimated, d = derived)
| name | value | src | note |
| bg | #0B1220 | m | page |
| ink | #E5E7EB | m | |
| brand | #3B82F6 | m | CTA |
type: font <family> (substitute for <?>), scale 14/16/20/32/48, weights 400/600, tracking -0.02em on display
space: base 8; radius 12 / pill; shadow soft 0 8px 24px rgba(0,0,0,.18)

## Regions (top -> bottom)
1. nav - contained 1200 - logo | 4 links | CTA button
2. hero - full-bleed gradient - 2 col 1.1fr/.9fr - ...
   must-not-substitute: <e.g. keep photo, not gradient>
   density: <what is visible at first screen>

## Components
| name | anatomy | states seen | states assumed | repeat |
| PlanCard | name, price, features[], badge, CTA | default, highlighted | hover, focus | 3 |

## Text inventory (verbatim, by region)
...

## Assets
| slot | role (bg/content) | source decision | file | note |

## Navigation (apps): tabs|stack|drawer, edges between screens

## Unknowns / assumptions
- font guessed; hover states invented; below-the-fold unseen; mobile layout assumed.

## Verification plan
- widths: <design>, 390; states to capture: <...>; region list to compare: <...>
```

`spec.json` (optional) mirrors tokens: `{ "canvas": {"w":1440,"dpr":2}, "tokens": {"colors":{...},"type":{...},"space":{...}}, "regions":[...], "assets":[...] }`.

# Blueprint template (design/blueprint.md)

```markdown
# <Brand> blueprint            version: 1   status: draft | confirmed
## Intent
category / audience / task; user override beats image inference; reference image = mood only (list what is borrowed: palette energy, layout rhythm, imagery style)
visual thesis: <one sentence mood + material + energy>
content plan: hero -> support/story -> detail/showcase -> final CTA
interaction thesis: 2-3 motion/interaction ideas that support hierarchy (not noise)

## Canvas
logical viewport(s): 1440 desktop, 390 mobile | document height estimate | generated mock-up pixel size
## Tokens
colors: bg, surface, surface-2, ink, muted, line, brand, accent, danger, ok (hex + role) [+ 12-step scale for brand if needed, labelled derived]
type: display <font>, body <font>, scale ratio <1.2|1.25|1.333>, sizes per breakpoint, line-height, tracking; fallback stack incl. CJK
space: base 4/8, container max-width, gutter; radius family; shadows; borders; motion durations
icons: set + stroke weight + sizes; logo treatment
## Grid and layout variant
columns, gaps, nav style, hero style, scroll behaviour, density
## Sections (each)
id | purpose | layout (cols, alignment) | exact copy | components | assets slots used | responsive collapse | must-not-substitute
## Asset slots
id | type (photo/illustration/logo/icon/bg/texture) | ratio + min px | background policy (transparent | flat-neutral | full-bleed | component-internal) | prompt | accessibility (alt / decorative / hidden text) | code-native alternative?
## Pages and routes
## Interactions (each with behaviour + states + keyboard)
## Stack and commands
default only if no repo: Vite/Next + Tailwind; motion library only when the interaction thesis needs it
## Open questions / assumptions
```
Rules: every value used in code must exist here; if the mock-up changes, update this file first; sample data labelled; no invented credentials/metrics.

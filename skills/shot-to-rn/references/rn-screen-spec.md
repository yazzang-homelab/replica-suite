# Per-screen spec template (docs/research/components/<screen>.spec.md)

```markdown
# <ScreenName> Specification
## Overview
- Target route/file: src/app/<route>.tsx
- Screenshots: docs/design-references/<default>.png (+ one per state)
- Navigation: reached via <tab | push from X | drawer>; goes to <Y, Z>
- States: default, <empty | loading | dark | modal | tab variants>

## Layout
Top-to-bottom regions, flex direction, alignment, spacing rhythm, safe-area + tab-bar insets.

## Components
### <Header>
- type: header/card/row/button/chip/avatar/input
- text: "<verbatim>"
- styling: bg <token>, text <color/size/weight>, padding ~16 (estimate), radius ~12 (estimate), border/shadow
(Mark every guess as ~estimate so the diff loop knows what to scrutinize.)

## Interactions (every affordance -> mechanism)
| Element | Affordance | Mechanism | On-device / Backend |
| task title | editable text | tap-to-edit TextInput -> update(id,{title}) | on-device |
| row | swipe-to-delete | Swipeable -> remove(id) | on-device |
| handle | drag reorder | sortable list -> persist order | on-device |
| sync icon | tap | stub + // TODO: wire backend | backend (cut) |
Checklist to walk: editable text, toggle/checkbox, add, delete, reorder, swipe action, long-press menu, pull-to-refresh, search/filter, picker/date, navigation, share/export.

## States and deltas
- loading: list -> 6 skeleton rows, shimmer
- dark: bg #0a0a0a, text #fafafa, border tokens

## Assets
- search icon: lucide `Search` | logo: recreate as neutral mark (needs-own-asset) | photo: crop raster / placeholder

## Text content (verbatim)
...every visible string...

## Mock data
Shape + sample rows matching what is shown; backend calls typed stubs with // TODO: wire backend.
```

Pre-dispatch checklist: spec filled; screenshot paths included; navigation in/out documented; Interactions table complete (every row wired or documented cut); each state delta captured; estimates flagged; asset decisions made; text verbatim; builder prompt <= ~150 lines.

Capture advice for the user: default + empty + loading + dark + every open overlay + each tab/segment variant; breadth beats polish - a blurry shot of a state you have beats a crisp shot of one you skipped.

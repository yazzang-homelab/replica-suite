# Screen spec template (`appclone/specs/<screen>.spec.md`)

```markdown
# <Screen> specification  (S07)
## Overview
- Target route/file: ...        - Reference: appclone/screens/S07*.png (+ state shots)
- Reached via: tab | push from S03 | drawer     - Leads to: S08, S09
- States: default, empty, loading, error, dark, modal-open

## Layout
Top-to-bottom regions, flex direction, alignment, spacing rhythm in tokens.

## Components
### Header
- type, text (your own wording unless it is a functional label), tokens used, `~estimate` values marked

## Interactions (every affordance -> mechanism)
| element | affordance | mechanism | on-device / backend |
| title | editable text | tap-to-edit -> update(id,{title}) | on-device |
| row | swipe-to-delete | swipe action -> remove(id) | on-device |
| sync icon | tap | cut: backend-only | backend |

## States & deltas
loading: list replaced by 6 skeleton rows; dark: tokens.dark.*; empty: illustration slot + CTA

## Assets
icon X -> open-set icon "Y"; illustration -> own placeholder; photo -> generated/own

## Mock data
Realistic fake rows matching counts/layout seen (never real people).

## Acceptance
- features rows: F-.. ; flows: F01 step 3; zero console errors; keyboard path works
```

## Builder prompt (inline, never "go read the file")
1. Full spec text. 2. Reference screenshot path(s). 3. Files the builder owns. 4. Shared things it must use: tokens, primitives, icon set, store/data hooks. 5. "Do not copy anything from the original; write fresh copy; run typecheck before finishing; report approximations." Complex screens: one builder per sub-component first, then one for the screen that composes them.

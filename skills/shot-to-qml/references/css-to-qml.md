# HTML / CSS / Tailwind -> QML

If the user supplies HTML, render it (Chromium via Playwright, `--font-render-hinting=none` so text metrics match Qt) at the design size and read computed styles instead of measuring pixels. Output is still Theme + components; wrapper `div`s that exist only for CSS become layout properties, repeated markup becomes a model.

## What extraction cannot see
`::before/::after` pieces (switch knobs, checkmarks), `:hover`/`:focus` rules unless active, gradient text (`background-clip:text`: mask a gradient by the text), Tailwind v4 gradients (interpolate in oklab; Qt interpolates sRGB, add a midpoint stop when end hues differ).

## Translation table
| CSS / Tailwind | QML |
|---|---|
| painted `div` | `Rectangle`; unpainted -> `Item` or a Layout |
| `display:flex; gap:G` | `RowLayout`/`ColumnLayout { spacing: G }` |
| `flex:1` | `Layout.fillWidth/Height: true` |
| `justify-content:space-between` | `Item { Layout.fillWidth: true }` spacers between children |
| `grid-template-columns: repeat(N,1fr)` | `GridLayout { columns: N }` with equal `preferredWidth` |
| `padding` | margins on the inner layout; remember borders are inside the box |
| `border-radius` | `radius`; per corner `topLeftRadius` (Qt 6.7+) |
| `border: 2px solid c` | `border.width: 2; border.color: c` |
| `box-shadow` | effects-profiles.md (MultiEffect on 6.8, RectangularShadow 6.9+) |
| `linear-gradient(...)` | `gradient: Gradient {...}` or `Shape` with `LinearGradient` |
| `rgba(0,0,0,.28)` | `"#47000000"` (alpha first: round(.28*255)=71=0x47) |
| `opacity` on a group | `opacity` + `layer.enabled: true` |
| `font-weight:600` | `Font.DemiBold` |
| `letter-spacing` | `letterSpacing` in the font token |
| `line-height:24px` | fixed-height Text, `verticalAlignment: AlignVCenter`; paragraphs `lineHeightMode: Text.FixedHeight` |
| `text-transform:uppercase` | write the uppercase string (Turkish `i` -> `İ` care; Korean unaffected) |
| `text-overflow:ellipsis` | `elide: Text.ElideRight` |
| `<img>` | `Image { sourceSize ... }` |
| inline `<svg>` | icon font, `VectorImage` (6.8+) or svgtoqml component |
| `:hover/:active/:disabled/:focus-visible` | control state bindings (`hovered`, `down`, `enabled`, `visualFocus`) |
| `<button> <input> <select> checkbox/range` | Template controls |
| `transition:all .2s` | `Behavior on <prop> { ColorAnimation/NumberAnimation { duration: 200 } }` |
| `position:absolute` | `anchors` inside the parent |
| `overflow:hidden` | `clip: true` (rectangular only) |
| `backdrop-filter: blur()` | MultiEffect blur - desktop only |

## Tailwind arithmetic
Spacing unit 4px (`p-6` = 24, `gap-2.5` = 10). Radius: `rounded` 4, `-md` 6, `-lg` 8, `-xl` 12, `-2xl` 16, `-3xl` 24, `-full` = half height. Type: `text-xs` 12/16, `-sm` 14/20, `-base` 16/24, `-lg` 18/28, `-xl` 20/28, `-2xl` 24/32, `-3xl` 30/36. Resolve palette names from the project's config; Tailwind v4 colors are oklch (convert to sRGB hex; v4 `indigo-600` differs from v3). `ring-2` = a 2px spread shadow drawn as an outside border. Ignore transparent `0 0 #0000` shadow slots.

# Layout and controls

## Canvas vs responsive
| Screen | Root | Why |
|---|---|---|
| kiosk / HMI / panel with known resolution | fixed `designWidth x designHeight` stage scaled by `fitScale` | pixel-exact on target, letterbox elsewhere |
| desktop app, resizable window | Layouts fill the window | reflows |
| mobile-style screen | responsive, design width as reference | heights scroll, widths reflow |
Inside a canvas still use Layouts; absolute `x/y` for whole screens is fidelity-mode only.

## Choose the positioning tool
1. Flowing row/column that may stretch -> `RowLayout`/`ColumnLayout`/`GridLayout`.
2. Wrap onto new lines -> `Flow` (Qt < 6.10); `FlexboxLayout` is a tech preview in 6.10+.
3. Overlay, corner badge, centered, edge-pinned -> `anchors`.
4. Fixed non-stretching children -> `Row`/`Column` (cheaper).
5. Scrolling -> `ListView`/`GridView`/`Flickable` with `clip: true`.
6. Absolute `x/y` only for computed geometry (charts, gauges).

## Gotchas that cost pixels
1. Nested layouts inherit `fillWidth`: a fixed-width column needs `Layout.fillWidth: false`.
2. Equal columns: set `Layout.preferredWidth: (row.width - (n-1)*row.spacing)/n`, no fillWidth.
3. `space-between` with text: spacer items, not centered cells.
4. `Rectangle.border` is drawn inside the box (like `border-box`).
5. Rounded corners do not clip children: use matching per-corner radii or a Shape/mask.
6. Layout positions snap to whole px; accept <=1px.
7. Properties named `onSomething` are handlers: use `accentInk`, not `onAccent`.
8. Single-line labels: `height: lineHeight; verticalAlignment: Text.AlignVCenter`; mixed sizes on one baseline: align `y` via `baselineOffset`.

## Controls
Build on `QtQuick.Templates` (`import QtQuick.Templates as T`): the template supplies pressed/checked/hovered state, keyboard handling, focus, touch and the accessibility role; you supply `background` and `contentItem` from the Theme. A `MouseArea`+`Rectangle` "button" has none of that.

| Need | Template |
|---|---|
| button, icon button | `T.Button` (variants primary/secondary/ghost/danger) |
| text input | `T.TextField` (hover, focus, error, disabled) |
| checkbox / radio / switch | `T.CheckBox` / `T.RadioButton` / `T.Switch` |
| slider / dial / range | `T.Slider` / `T.Dial` / `T.RangeSlider` |
| combo / spin | `T.ComboBox` / `T.SpinBox` |
| segmented / tabs | `T.TabBar` + `T.TabButton` |
| progress / tooltip / menu / dialog | `T.ProgressBar` / `T.ToolTip` / `T.Menu` / `T.Dialog` |

Token roles controls read: `bg surface text textMuted placeholder accent accentInk accentHover accentPressed border borderStrong track knob surfaceHover surfacePressed danger* focusRing focusRingWidth controlHeight controlPadding radiusControl borderWidth touchTarget motionFast disabledOpacity fontControl fontInput`. Measured states override defaults (a hovered row color goes into the spec under its role name). Missing a role -> derive (`Qt.darker(accent, 1.1)`) and list it as assumed. Touch/kiosk targets >= 44x44px.

## Accessibility and i18n
`Accessible.name` for icon-only buttons, sliders, combos, progress bars, gauges; `Accessible.role` for non-controls; `Accessible.ignored: true` for decorative glyphs. Tab order = reading order, one Tab stop per control. Visible pressed state. Keep the design's colors; if body contrast < 4.5:1 mention it in the README. Visible strings in `qsTr()`; ship `.ts`/`.qm` when a second language is requested. Korean/CJK: bundle or require a CJK-capable font (Noto Sans KR, Pretendard) so glyphs do not fall back to tofu.

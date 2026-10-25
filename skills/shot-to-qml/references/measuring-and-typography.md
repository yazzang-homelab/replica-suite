# Measuring and typography (QML build)

## Measure with probes
```bash
python ../shot-analyze/scripts/probe.py in.png --dpr 2 color X Y [X Y ...]     # exact point colors (3x3 median)
python ../shot-analyze/scripts/probe.py in.png --dpr 2 region X Y W H          # dominant colors (fill/text/border candidates)
python ../shot-analyze/scripts/probe.py in.png --dpr 2 edges X Y W H           # element edges, borders, padding from solid runs
python ../shot-analyze/scripts/probe.py in.png --dpr 2 crop X Y W H --zoom 6 --out c.png
```
Measure many points per call. Colors: solid fills reliable, gradients/anti-aliased edges approximate. Alpha surfaces: solve `observed = a*fg + (1-a)*bg` against the known backdrop. Geometry: padding = edge distance - border; gap = distance between sibling boxes; radius from corner curve. Estimate sizes of text from ink height / line pitch and confirm by rendering.

## Design size and DPR
All spec coordinates are design px = screenshot px / DPR. Canvas projects use the screen's real resolution (1920x1080, 1280x800 ...). Several screenshots of one screen (states, themes) share one tokens table; per-state deltas go on the node.

## Fonts
- Identify by shapes (G spur, R leg, single/double-storey a, rounded terminals, slashed zero) and by advance widths; mixed screens often pair a sans for labels with a mono for values (measure per-character width: ~0.6em means monospace).
- Open families (OFL: Inter, Roboto, Manrope, DM Sans, Nunito, Outfit, Barlow, JetBrains Mono, Plus Jakarta Sans, Space Grotesk, Pretendard, Noto Sans KR) may be bundled with their licence in `assets/fonts/`; prefer static TTF per weight. Proprietary faces: never bundle, pick the nearest open family, fit sizes so text **widths** match the image, name the substitute in the README.
- Qt vs browser metrics differ: set `pixelSize` explicitly, use `lineHeight` + `Text.FixedHeight`, then adjust by measured width.
- Casing: write the actual uppercase string (do not rely on `font.capitalization` for locale-specific casing).

## Icons
Identify the set by style (24-grid 2px round strokes -> Lucide; slightly denser -> Tabler; solid heavy + brands -> Font Awesome; rounded variable weight -> Material Symbols; thin/duotone -> Phosphor); strokes at 1.5/1.75 instead of 2 are common and visible. Export SVG with the measured stroke + color; `VectorImage` for fixed color, `svgtoqml` (or an icon font with codepoints) when color must follow Theme. Never redraw by hand. Record `set:name` + confidence; below ~0.9 say "closest match".

## Shadows, gradients
Fit CSS `box-shadow` (x y blur spread color) from the ring of pixels around a box; multi-layer shadows are reproduced as one equivalent layer. Gradients: angle from the steepest-change direction, 2-4 stops from colors along the gradient line, ignoring overlaid content.

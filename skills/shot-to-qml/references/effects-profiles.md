# Effects, profiles, version gates, packaging

## Profiles
| Profile | Hardware | Rendering | Rules |
|---|---|---|---|
| `desktop` | PC/laptop | RHI (GL/Vulkan/Metal/D3D) | any effect |
| `embedded-gpu` | RPi 4/5, Jetson, i.MX8 | OpenGL ES via `eglfs` | shadows/gradients OK, **no blur**, <=4 offscreen layers, targets >=44px, set `sourceSize` on images |
| `embedded-sw` | no/broken GPU | software scene graph (`QT_QUICK_BACKEND=software`, `linuxfb`) | **no shader effects at all**: flat colors, borders, gradients only |
`embedded-sw` flat fallbacks: shadow -> 1px darker border or an offset second rect; glass -> opaque tint; glow -> nothing. List them in the README. Render checks on that profile with the software scene graph so the diff scores what the device draws.

## Effects
- Shadow: Qt 6.9+ `RectangularShadow` (cheap SDF, declared before the card); Qt 6.8 `MultiEffect` with `layer.enabled`, `shadowEnabled`, `shadowBlur: 1.0`, `blurMax` ~ 2.4x the CSS blur (blur 10 -> 24). Measured CSS blur draws slightly softer in Qt; calibrate by comparing a crop.
- Gradients: `Shape` + `LinearGradient/RadialGradient/ConicalGradient` (works on all profiles). Mid-stop for oklab ends.
- Blur/glass: `MultiEffect` blur over a `ShaderEffectSource` - desktop only.
- Rounded clipping: `clip` is rectangular; use per-corner radii, a Shape, or `MultiEffect` mask. Gradient borders: mask composite or two shapes.
- Group opacity: `layer.enabled: true` + `opacity`.

## Qt version gates
| Feature | Min Qt | Fallback |
|---|---|---|
| `loadFromModule`, `MultiEffect` | 6.5 | `engine.load(url)`, layered rects |
| per-corner `Rectangle` radius | 6.7 | Shape `PathRectangle`/`PathSvg` |
| `VectorImage`, `svgtoqml`, `PathRectangle` | 6.8 | `Image` + `sourceSize` |
| `RectangularShadow` | 6.9 | `MultiEffect` shadow |
| `FlexboxLayout` (preview) | 6.10 | `Flow` / `RowLayout` |
Check `python -c "import PySide6; print(PySide6.__version__)"` and use only what the target has.

## Hosts
PySide6: `pip install PySide6`, `main.py` loads `engine.loadFromModule("App", "Main")`; `pyside6-deploy main.py` for a bundle. C++ (CMake, Qt 6.8+): `qt_add_qml_module` per folder with a `qmldir`, fonts/translations in resources; both hosts must render the same `qml/` tree (compare their frames).

## Embedded run
```bash
export QT_QPA_PLATFORM=eglfs QT_QPA_EGLFS_INTEGRATION=eglfs_kms QT_QPA_EGLFS_HIDECURSOR=1   # GPU board
# GPU-less: QT_QPA_PLATFORM=linuxfb QT_QUICK_BACKEND=software
```
Kiosk packaging: environment file, systemd unit (`Restart=always`, user session), install script; keep infinite animations off while idle; clocks tick at 1 s not 16 ms.

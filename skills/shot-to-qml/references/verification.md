# Verification for QML builds

A project is done when the check passes, not when it "looks right".

## Headless render (sketch - verify against your PySide6 version)
```python
# render_qml.py - run:  QT_QPA_PLATFORM=offscreen python render_qml.py out.png 1920 1080 2
import sys
from PySide6.QtCore import QUrl
from PySide6.QtGui import QGuiApplication
from PySide6.QtQuick import QQuickView
out, w, h, dpr = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
app = QGuiApplication(sys.argv)
view = QQuickView(); view.setResizeMode(QQuickView.SizeRootObjectToView)
view.engine().addImportPath("qml"); view.setSource(QUrl.fromLocalFile("qml/App/Main.qml"))
view.resize(int(w), int(h)); view.show()
app.processEvents(); 
img = view.grabWindow(); img.save(out); print(img.width(), img.height())
```
Render size must equal the source pixel size (`designSize x DPR`); the offscreen platform uses the software scene graph, so shader effects will not appear - use Xvfb (`xvfb-run`) with a GL stack to see them. Wait a few event-loop ticks for images/fonts before grabbing.

## Compare
1. `node ../shot-compare-iterate/scripts/compare.mjs --target input.png --render out.png --out out/.check`
2. Open `side-by-side.png` and the worst crops; do not rely on the number.
3. Text: dump `Text` items (string, x, baseline) from the scene and compare with the spec; pixel diff on glyphs is noise.

## What the metrics mean
| Metric | Measures | Pass |
|---|---|---|
| global SSIM (text masked) | frame structure | >= 0.98 |
| region SSIM per node >24x24 | local structure, best of 1px shifts | >= 0.90 |
| CIEDE2000 on solid fills | color | <= 2.0 |
| geometry offset | node shift by template match | <= 2px |
| text strings found | content | 100% |
| text offset | edge/baseline | <= 2px |

## Fix by failure type
| Failure | Usual cause | Fix |
|---|---|---|
| many offsets with the same dx | parent shifted/wider | fix the parent |
| one column too wide | nested `fillWidth`, unequal columns | layout gotchas 1-2 |
| text offsets growing along a line | letter spacing, wrong weight/family | typography |
| text dy 2-4px | line box height | fixed-height Text + AlignVCenter |
| color delta > 2 | wrong token, missing alpha, `#RRGGBBAA` order | tokens |
| region SSIM low, colors right | missing border/shadow/gradient, radius | compare the crop pair |

## Rules that keep numbers honest
Never put the screenshot (or a crop) in the UI; never edit thresholds or the spec to pass; assumed values stay marked assumed even if the check passes; if a threshold is unreachable (blur on an embedded profile) say so in the README. Stop at pass, the round limit, or when two rounds improve global SSIM by < 0.005.

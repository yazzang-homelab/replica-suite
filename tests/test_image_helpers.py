import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


class ImageHelperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def image(self, name, size, color):
        path = self.root / name
        Image.new("RGBA", size, color).save(path)
        return path

    def run_script(self, relative, *args):
        interpreter = sys.executable if relative.endswith(".py") else "node"
        return subprocess.run([interpreter, str(ROOT / relative), *map(str, args)], cwd=ROOT,
                              capture_output=True, text=True, timeout=30)

    def test_color_probe_measures_pixels(self):
        source = self.image("input.png", (40, 40), (18, 52, 86, 255))
        result = self.run_script("skills/shot-analyze/scripts/probe.py", source, "color", 10, 10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)[0]["hex"], "#123456")

    def test_section_slices_follow_device_pixel_ratio(self):
        source = self.image("input.png", (40, 80), (1, 2, 3, 255))
        meta = self.root / "outline.json"
        meta.write_text(json.dumps({"viewport": {"w": 20}, "outline": [{"y": 10, "h": 15, "heading": "Panel"}]}))
        result = self.run_script("skills/web-capture/scripts/slice_sections.py", source, meta, self.root / "slices")
        self.assertEqual(result.returncode, 0, result.stderr)
        with Image.open(self.root / "slices/00-panel.png") as crop:
            self.assertEqual(crop.size, (40, 30))

    def test_transparency_gate_rejects_opaque_asset(self):
        opaque = self.image("opaque.png", (20, 20), (100, 120, 140, 255))
        result = self.run_script("skills/shot-design-pipeline/scripts/check_alpha.mjs", opaque, "--require-transparency")
        self.assertEqual(result.returncode, 2, result.stderr)
        with Image.open(opaque) as image:
            image.putpixel((0, 0), (100, 120, 140, 0))
            transparent = self.root / "transparent.png"
            image.save(transparent)
        result = self.run_script("skills/shot-design-pipeline/scripts/check_alpha.mjs", transparent, "--require-transparency")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_single_pixel_image_resizes_without_false_mismatch(self):
        target = self.image("target.png", (4, 4), (100, 120, 140, 255))
        render = self.image("render.png", (1, 1), (100, 120, 140, 255))
        result = self.run_script("skills/shot-compare-iterate/scripts/compare.mjs", "--target", target,
                                 "--render", render, "--out", self.root / "diff", "--tolerance", 0)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads((self.root / "diff/report.json").read_text())
        self.assertEqual(report["globalMismatchPct"], 0)
        self.assertEqual(report["heightDelta"], 0)

    def test_invalid_comparison_options_fail(self):
        source = self.image("source.png", (4, 4), (100, 120, 140, 255))
        for flag, value in (("--bands", "0"), ("--grid", "0x0"), ("--align", "wrong"), ("--tolerance", "NaN")):
            with self.subTest(flag=flag):
                result = self.run_script("skills/shot-compare-iterate/scripts/compare.mjs", "--target", source,
                                         "--render", source, "--out", self.root / "diff", flag, value)
                self.assertEqual(result.returncode, 2)

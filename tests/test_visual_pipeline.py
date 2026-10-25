import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lib.images import save_rgba  # noqa: E402

DIFF = ROOT / "skills/web-verify-pixel/scripts/pixel_diff.py"


class PixelGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.name = "site-2x2-top.png"
        self.base = bytearray([100, 100, 100, 255] * 4)
        self.write("reference", self.base)
        self.write("replica", self.base)

    def write(self, group, data, width=2):
        save_rgba(str(self.root / group / self.name), width, 2, data)

    def run_diff(self, *flags):
        return subprocess.run([sys.executable, str(DIFF), "--root", str(self.root),
                               "--viewports", "2x2", "--kinds", "top", *flags], capture_output=True, text=True)

    def report(self):
        return json.loads((self.root / "diff/report.json").read_text())[0]

    def test_identical_images_pass(self):
        result = self.run_diff("--strict")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.report()["changedPixels"], 0)

    def test_strict_catches_one_channel_step(self):
        changed = self.base[:]
        changed[0] += 1
        self.write("replica", changed)
        self.assertEqual(self.run_diff("--strict").returncode, 2)
        self.assertEqual(self.report()["changedPixels"], 1)
        self.assertEqual(self.report()["changedRatio"], 0.25)

    def test_alpha_change_is_counted(self):
        changed = self.base[:]
        changed[3] = 0
        self.write("replica", changed)
        self.assertEqual(self.run_diff("--strict").returncode, 2)
        self.assertEqual(self.report()["maxChannelDelta"], 255)

    def test_explicit_tolerance_accepts_small_change(self):
        changed = self.base[:]
        changed[0] += 1
        self.write("replica", changed)
        self.assertEqual(self.run_diff("--threshold", "2", "--max-ratio", "0").returncode, 0)

    def test_size_and_missing_pair_fail(self):
        self.write("replica", self.base[:8], width=1)
        self.assertEqual(self.run_diff().returncode, 2)
        self.assertTrue(self.report()["sizeMismatch"])
        (self.root / "replica" / self.name).unlink()
        self.assertEqual(self.run_diff().returncode, 2)
        self.assertTrue(self.report()["missing"])

    def test_invalid_options_do_not_pass(self):
        for flags in (("--viewports", ""), ("--kinds", ","), ("--bands", "0"),
                      ("--max-ratio", "nan"), ("--max-ratio", "-1"), ("--threshold", "256")):
            with self.subTest(flags=flags):
                self.assertNotEqual(self.run_diff(*flags).returncode, 0)

    def test_capture_rejects_unsafe_prefix_before_launch(self):
        capture = ROOT / "skills/web-verify-pixel/scripts/capture_matrix.mjs"
        result = subprocess.run(["node", str(capture), "--url=http://127.0.0.1/", "--prefix=../escape"],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("filename component", result.stderr)

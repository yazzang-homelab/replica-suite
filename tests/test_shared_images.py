import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from lib import images  # noqa: E402

IMGDIFF = ROOT / "skills/app-parity-test/scripts/imgdiff.py"
PIXEL = ROOT / "skills/web-verify-pixel/scripts/pixel_diff.py"


class SharedImageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_rgba_roundtrip_preserves_alpha_and_creates_parents(self):
        data = bytearray([10, 20, 30, 0, 40, 50, 60, 128, 70, 80, 90, 255, 1, 2, 3, 4])
        path = self.root / "a/b/c.png"
        images.save_rgba(path, 2, 2, data)
        self.assertEqual(images.load_rgba(path), (2, 2, data))

    def test_rgb_rows_roundtrip(self):
        rows = [[(1, 2, 3), (4, 5, 6)]]
        path = self.root / "rows.png"
        images.save_rgb_rows(path, 2, 1, rows)
        self.assertEqual(images.load_rgb_rows(path), (2, 1, rows))

    def test_white_composite_uses_floor_division(self):
        path = self.root / "alpha.png"
        Image.frombytes("RGBA", (2, 1), bytes([100, 50, 0, 128, 0, 0, 0, 0])).save(path)
        _, _, rows = images.load_rgb_rows(path)
        self.assertEqual(rows[0][0], ((100 * 128 + 255 * 127) // 255, (50 * 128 + 255 * 127) // 255,
                                      (0 * 128 + 255 * 127) // 255))
        self.assertEqual(rows[0][1], (255, 255, 255))
        self.assertEqual(images.load_rgba(path)[2][3], 128)

    def test_palette_with_trns(self):
        im = Image.new("P", (2, 1))
        im.putpalette([255, 0, 0, 0, 255, 0])
        im.putpixel((1, 0), 1)
        path = self.root / "pal.png"
        im.save(path, transparency=bytes([255, 0]))
        w, h, rgba = images.load_rgba(path)
        self.assertEqual(bytes(rgba), bytes([255, 0, 0, 255, 0, 255, 0, 0]))
        self.assertEqual(images.load_rgb_rows(path)[2][0], [(255, 0, 0), (255, 255, 255)])

    def test_gray16_uses_high_byte(self):
        path = self.root / "g16.png"
        Image.frombytes("I;16", (3, 1), (0x0000).to_bytes(2, "little") + (0x80FF).to_bytes(2, "little")
                        + (0xFFFF).to_bytes(2, "little")).save(path)
        _, _, rows = images.load_rgb_rows(path)
        self.assertEqual(rows[0], [(0, 0, 0), (0x80, 0x80, 0x80), (255, 255, 255)])

    def test_gray_low_depth_scales(self):
        path = self.root / "g1.png"
        Image.frombytes("1", (2, 1), bytes([0b01000000])).save(path)
        self.assertEqual(images.load_rgb_rows(path)[2][0], [(0, 0, 0), (255, 255, 255)])

    def test_corrupt_truncated_and_non_png_rejected(self):
        good = self.root / "good.png"
        Image.effect_noise((64, 64), 80).convert("RGB").save(good)
        raw = good.read_bytes()
        cases = {"trunc.png": raw[:len(raw) // 2], "junk.png": b"not a png at all",
                 "empty.png": b"", "header.png": raw[:20]}
        jpeg = self.root / "pic.png"
        Image.new("RGB", (4, 4)).save(jpeg, format="JPEG")
        for name, data in cases.items():
            (self.root / name).write_bytes(data)
        for name in list(cases) + ["pic.png"]:
            with self.subTest(name=name), self.assertRaises(images.ImageError):
                images.load_rgba(self.root / name)

    def test_pixel_limit_rejected_before_decode(self):
        path = self.root / "big.png"
        Image.new("L", (1000, 1000)).save(path)
        old = images.MAX_PIXELS
        images.MAX_PIXELS = 999_999
        self.addCleanup(setattr, images, "MAX_PIXELS", old)
        with self.assertRaises(images.ImageError):
            images.load_rgba(path)

    def test_invalid_sizes_and_buffers_rejected(self):
        p = self.root / "x.png"
        for args in ((0, 1, bytes(0)), (1, 0, bytes(0)), (-1, 1, bytes(4)), (1.5, 1, bytes(4)),
                     (True, 1, bytes(4)), (2, 1, bytes(4)), (1, 1, bytes(5)), (1, 1, "abcd"),
                     (images.MAX_PIXELS + 1, 1, bytes(4))):
            with self.subTest(args=args[:2]), self.assertRaises(images.ImageError):
                images.save_rgba(p, *args)
        for rows in ([], [[(1, 2, 3)], [(1, 2, 3)]], [[(1, 2)]], [[(1, 2, 256)]], [[(1, 2, -1)]],
                     [[(1, 2, "x")]], [[(1, 2, 3), (1, 2, 3)]]):
            with self.subTest(rows=rows), self.assertRaises(images.ImageError):
                images.save_rgb_rows(p, 1, 1, rows)
        self.assertFalse(p.exists())


class CliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.cwd = self.root / "elsewhere"
        self.cwd.mkdir()

    def run_cli(self, script, *args):
        return subprocess.run([sys.executable, str(script), *map(str, args)], cwd=self.cwd,
                              capture_output=True, text=True, timeout=60)

    def test_imgdiff_runs_from_other_cwd_and_preserves_schema_and_score(self):
        a, b, out = self.root / "a.png", self.root / "b.png", self.root / "o/diff.png"
        Image.new("RGB", (60, 60), (255, 255, 255)).save(a)
        im = Image.new("RGB", (60, 60), (255, 255, 255))
        im.paste((0, 0, 0), (0, 0, 30, 60))
        im.save(b)
        same = self.run_cli(IMGDIFF, a, a, "--json", "--width", "60", "--cols", "3")
        self.assertEqual(same.returncode, 0, same.stderr)
        report = json.loads(same.stdout)
        self.assertEqual(set(report), {"mode", "original", "clone", "compared_at", "height_delta_pct",
                                       "score", "verdict", "regions", "files"})
        self.assertEqual(report["score"], 100.0)
        self.assertEqual(report["verdict"], "matches")
        pix = self.run_cli(IMGDIFF, a, b, "--mode", "pixel", "--json", "--width", "60", "--cols", "3",
                           "--out", out)
        self.assertEqual(pix.returncode, 0, pix.stderr)
        report = json.loads(pix.stdout)
        self.assertEqual(report["changed_pixels"], 1800)
        self.assertEqual(report["score"], 50.0)
        self.assertEqual(report["diff_image"], str(out))
        self.assertEqual(Image.open(out).size, (60, 60))
        self.assertEqual(self.run_cli(IMGDIFF, a, b, "--mode", "pixel", "--fail-under", "99").returncode, 1)

    def test_imgdiff_reports_bad_input_with_exit_2(self):
        bad = self.root / "bad.png"
        bad.write_bytes(b"\x89PNG\r\n\x1a\ntruncated")
        result = self.run_cli(IMGDIFF, bad, bad)
        self.assertEqual(result.returncode, 2)
        self.assertIn("imgdiff:", result.stderr)

    def test_pixel_diff_runs_from_other_cwd_and_preserves_schema(self):
        name = "site-4x4-top.png"
        ref, rep = self.root / "reference" / name, self.root / "replica" / name
        data = bytearray([100, 100, 100, 255] * 16)
        images.save_rgba(ref, 4, 4, data)
        data[0] += 5
        images.save_rgba(rep, 4, 4, data)
        result = self.run_cli(PIXEL, "--root", self.root, "--viewports", "4x4", "--kinds", "top",
                              "--strict")
        self.assertEqual(result.returncode, 2, result.stderr)
        record = json.loads((self.root / "diff/report.json").read_text())[0]
        self.assertEqual(set(record), {"refSize", "repSize", "sizeMismatch", "changedPixels", "totalPixels",
                                       "changedRatio", "avgChannelDelta", "maxChannelDelta", "bbox",
                                       "worstBands", "diff", "name", "pass"})
        self.assertEqual((record["changedPixels"], record["totalPixels"], record["maxChannelDelta"]),
                         (1, 16, 5))
        self.assertEqual(record["bbox"], [0, 0, 0, 0])
        self.assertEqual(record["avgChannelDelta"], round(5 / 3 / 16, 5))
        self.assertEqual(images.load_rgba(self.root / "diff" / "site-4x4-top-diff.png")[2][:4],
                         bytearray([255, 0, 255, 255]))

    def test_pixel_diff_corrupt_input_fails_nonzero(self):
        name = "site-2x2-top.png"
        images.save_rgba(self.root / "reference" / name, 2, 2, bytes(16))
        (self.root / "replica").mkdir()
        (self.root / "replica" / name).write_bytes(b"\x89PNG\r\n\x1a\ngarbage")
        result = self.run_cli(PIXEL, "--root", self.root, "--viewports", "2x2", "--kinds", "top")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("pixel_diff:", result.stderr)


if __name__ == "__main__":
    unittest.main()

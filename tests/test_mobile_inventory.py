import hashlib
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile

from scripts.inspect_mobile import inspect


class MobileInventoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.package = Path(self.temp.name) / "app.apk"

    def archive(self, files):
        with zipfile.ZipFile(self.package, "w") as archive:
            for name, data in files:
                archive.writestr(name, data)

    def test_flutter_and_unity_inventory_without_extraction(self):
        metadata = struct.pack("<II", 0xFAB11BAF, 39)
        self.archive([("lib/arm64-v8a/libapp.so", b"flutter"),
                      ("lib/arm64-v8a/libil2cpp.so", b"native"),
                      ("assets/bin/Data/Managed/Metadata/global-metadata.dat", metadata)])
        result = inspect(self.package)
        self.assertEqual(result["frameworks"], ["flutter", "unity-il2cpp"])
        self.assertEqual(result["artifacts"][0]["abi"], "arm64-v8a")
        self.assertEqual(result["artifacts"][0]["sha256"], hashlib.sha256(b"flutter").hexdigest())
        self.assertEqual(result["artifacts"][2]["metadata_version"], 39)
        self.assertEqual(list(Path(self.temp.name).iterdir()), [self.package])

    def test_ipa_framework_is_detected(self):
        self.archive([("Payload/Own.app/Frameworks/App.framework/App", b"test")])
        self.assertEqual(inspect(self.package)["frameworks"], ["flutter"])

    def test_bad_metadata_remains_unknown(self):
        self.archive([("global-metadata.dat", b"short")])
        result = inspect(self.package)
        self.assertFalse(result["artifacts"][0]["metadata_magic_valid"])
        self.assertIsNone(result["artifacts"][0]["metadata_version"])
        self.assertIn("truncated", result["limitations"][-1])

    def test_member_traversal_is_rejected(self):
        for name in ("../outside", "/absolute", "a\\..\\outside", "C:/file"):
            with self.subTest(name=name):
                self.archive([(name, b"x")])
                with self.assertRaisesRegex(ValueError, "Unsafe"):
                    inspect(self.package)

    def test_symlink_is_rejected(self):
        member = zipfile.ZipInfo("link")
        member.create_system = 3
        member.external_attr = (0o120777 << 16)
        self.archive([(member, b"../../outside")])
        with self.assertRaisesRegex(ValueError, "Symlink"):
            inspect(self.package)

    def test_entry_and_total_budgets_are_enforced(self):
        self.archive([("lib/arm64/libapp.so", b"a" * 32), ("lib/arm64/libflutter.so", b"b" * 32)])
        with self.assertRaisesRegex(ValueError, "limit"):
            inspect(self.package, max_entry=16)
        with self.assertRaisesRegex(ValueError, "budget"):
            inspect(self.package, max_total=48)

    def test_unrecognized_package_does_not_guess_runtime(self):
        self.archive([("classes.dex", b"dex")])
        self.assertEqual(inspect(self.package)["frameworks"], [])

    def test_invalid_archive_rejected(self):
        self.package.write_bytes(b"not zip")
        with self.assertRaises(zipfile.BadZipFile):
            inspect(self.package)

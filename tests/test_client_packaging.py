import json
from pathlib import Path
import tempfile
import unittest

from scripts.check_clients import BUNDLE_DIRS, BUNDLE_FILES, ROOT, isolated_env, stage_bundle, verify_resources
from scripts.validate_plugin import README_FILES, validate_client_metadata


class ClientPackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / "bundle"
        stage_bundle(ROOT, self.bundle)

    def change(self, relative, update):
        path = self.bundle / relative
        data = json.loads(path.read_text())
        update(data)
        path.write_text(json.dumps(data))

    def test_staged_bundle_preserves_all_skill_resources(self):
        names = {p.parent.name for p in (ROOT / "skills").glob("*/SKILL.md")}
        verify_resources(self.bundle, ROOT, names)
        self.assertEqual({p.name for p in self.bundle.iterdir()}, set(BUNDLE_DIRS) | set(BUNDLE_FILES))
        self.assertFalse((self.bundle / "node_modules").exists())
        self.assertFalse((self.bundle / ".git").exists())
        self.assertFalse(list(self.bundle.rglob("__pycache__")))

    def test_moved_resource_or_corrupt_copy_is_rejected(self):
        names = {"replica"}
        library = self.bundle / "lib/browser.mjs"
        library.write_text("not the original library")
        with self.assertRaisesRegex(AssertionError, "differs"):
            verify_resources(self.bundle, ROOT, names)
        library.unlink()
        with self.assertRaisesRegex(AssertionError, "missing"):
            verify_resources(self.bundle, ROOT, names)

    def test_client_version_drift_is_rejected(self):
        self.change("plugin.json", lambda data: data.update(version="0.0.1"))
        self.assertTrue(any("identity/version" in error for error in validate_client_metadata(self.bundle)))

    def test_skill_only_codex_source_is_rejected(self):
        self.change(".agents/plugins/marketplace.json", lambda data: data["plugins"][0]["source"].update(path="./skills"))
        self.assertTrue(any("entire shared bundle" in error for error in validate_client_metadata(self.bundle)))

    def test_marketplace_drift_and_binding_only_manifest_are_rejected(self):
        self.change(".agents/plugins/marketplace.json", lambda data: data.update(name="another-market"))
        (self.bundle / "gajae-plugin.json").write_text("{}")
        errors = validate_client_metadata(self.bundle)
        self.assertTrue(any("IDs differ" in error for error in errors))
        self.assertTrue(any("Binding-only" in error for error in errors))

    def test_every_translation_is_required_and_cross_linked(self):
        for name in README_FILES:
            text = (self.bundle / name).read_text()
            for other in README_FILES:
                if other != name:
                    self.assertIn(other, text, f"{name} missing language switch to {other}")
        (self.bundle / "README.ja.md").unlink()
        self.assertTrue(any("README.ja.md" in error for error in validate_client_metadata(self.bundle)))

    def test_settings_are_isolated_and_tokens_not_forwarded(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-only", "GH_TOKEN": "test-only", "HOME": "/original"}):
            env = isolated_env(self.root / "isolated")
        self.assertNotIn("OPENAI_API_KEY", env)
        self.assertNotIn("GH_TOKEN", env)
        for key in ("HOME", "CODEX_HOME", "CLAUDE_CONFIG_DIR", "GJC_CODING_AGENT_DIR", "XDG_CONFIG_HOME"):
            self.assertTrue(Path(env[key]).is_relative_to(self.root))
        self.assertTrue(Path(env["GJC_CODING_AGENT_DIR"]).is_dir())

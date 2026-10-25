import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import brand  # noqa: E402


def run(*argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = brand.main(list(argv))
    return code, out.getvalue(), err.getvalue()


def put(root, rel, content, mode="w"):
    p = Path(root) / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if mode == "wb":
        p.write_bytes(content)
    else:
        p.write_text(content, encoding="utf-8")
    return p


class ScanTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = self._tmp.name
        self.addCleanup(self._tmp.cleanup)

    def scan_json(self, *extra):
        code, out, _ = run("scan", self.root, "--json", *extra)
        return code, json.loads(out)

    def test_name_variants_domain_color(self):
        put(self.root, "a.txt", "OldCo here\nold-co and old_co and Old  Co\nvisit OLD.example\n"
            "color #ABC and #aabbcc and #123456 and #12345678\n")
        code, rep = self.scan_json("--names", "Old Co", "--domains", "old.example",
                                   "--colors", "#aabbcc")
        self.assertEqual(code, 1)
        self.assertEqual(rep["status"], "hits")
        kinds = [(h["kind"], h["line"]) for h in rep["hits"]]
        self.assertEqual([k for k in kinds if k[0] == "name"], [("name", 1), ("name", 2)])
        self.assertIn(("domain", 3), kinds)
        colors = [h for h in rep["hits"] if h["kind"] == "color"]
        self.assertEqual({h["match"] for h in colors}, {"#aabbcc"})
        self.assertEqual(len(colors), 2)
        self.assertEqual(rep["hit_count"], len(rep["hits"]))

    def test_domain_is_literal(self):
        put(self.root, "a.txt", "oldXexample\n")
        code, rep = self.scan_json("--domains", "old.example")
        self.assertEqual(code, 0)
        self.assertEqual(rep["status"], "clean")

    def test_path_hits_for_files_and_dirs(self):
        put(self.root, "OldCo-dir/x.txt", "nothing")
        put(self.root, "sub/old_co.txt", "nothing")
        code, rep = self.scan_json("--names", "Old Co")
        self.assertEqual(code, 1)
        files = {h["file"] for h in rep["hits"] if h["kind"] == "path"}
        self.assertEqual(files, {"OldCo-dir/", os.path.join("sub", "old_co.txt")})

    def test_binary_content_excluded_but_name_checked(self):
        put(self.root, "blob.bin", b"\0OldCo\0", "wb")
        put(self.root, "oldco.png", b"\x89PNG OldCo", "wb")
        code, rep = self.scan_json("--names", "OldCo")
        self.assertEqual({h["kind"] for h in rep["hits"]}, {"path"})
        self.assertEqual({h["file"] for h in rep["hits"]}, {"oldco.png"})

    def test_exclusions_and_evidence_flag(self):
        for d in (".git", "node_modules", "dist", "build", ".venv"):
            put(self.root, d + "/f.txt", "OldCo")
        put(self.root, "package-lock.json", "OldCo")
        put(self.root, "replica/e.txt", "OldCo")
        put(self.root, "appclone/e.txt", "OldCo")
        code, _ = self.scan_json("--names", "OldCo")
        self.assertEqual(code, 0)
        code, rep = self.scan_json("--names", "OldCo", "--include-evidence")
        self.assertEqual(code, 1)
        self.assertEqual({h["file"] for h in rep["hits"]},
                         {os.path.join("replica", "e.txt"), os.path.join("appclone", "e.txt")})

    def test_symlinks_not_followed(self):
        with tempfile.TemporaryDirectory() as outside:
            put(outside, "secret.txt", "OldCo")
            try:
                os.symlink(outside, os.path.join(self.root, "linkdir"))
                os.symlink(os.path.join(outside, "secret.txt"),
                           os.path.join(self.root, "linkfile.txt"))
            except (OSError, NotImplementedError):
                self.skipTest("symlinks unavailable")
            code, rep = self.scan_json("--names", "OldCo")
            self.assertEqual(code, 0)
            self.assertEqual(rep["hits"], [])

    def test_config_merge_and_config_excluded(self):
        put(self.root, "a.txt", "OldCo and old.example and #123456")
        cfg = put(self.root, "brand.json", json.dumps(
            {"avoid": ["OldCo"], "domains": ["old.example"], "colors": ["#123456"]}))
        code, rep = self.scan_json("--config", str(cfg))
        self.assertEqual(code, 1)
        self.assertEqual({h["file"] for h in rep["hits"]}, {"a.txt"})
        self.assertEqual(rep["counts"], {"color": 1, "domain": 1, "name": 1})

    def test_text_output(self):
        put(self.root, "a.txt", "OldCo")
        code, out, _ = run("scan", self.root, "--names", "OldCo")
        self.assertEqual(code, 1)
        self.assertIn("a.txt:1", out)

    def test_invalid_inputs_exit_2(self):
        missing = os.path.join(self.root, "nope")
        self.assertEqual(run("scan", missing, "--names", "X")[0], 2)
        self.assertEqual(run("scan", self.root)[0], 2)
        self.assertEqual(run("scan", self.root, "--colors", "#12345")[0], 2)
        self.assertEqual(run("scan", self.root, "--colors", "red")[0], 2)
        self.assertEqual(run("scan", self.root, "--config",
                             os.path.join(self.root, "missing.json"))[0], 2)
        for name, body in (("empty.json", "{}"), ("list.json", "[]"), ("bad.json", "{"),
                           ("type.json", '{"avoid": "OldCo"}'),
                           ("item.json", '{"avoid": [1]}'),
                           ("key.json", '{"names": ["x"]}')):
            cfg = put(self.root, name, body)
            code, _, err = run("scan", self.root, "--config", str(cfg))
            self.assertEqual(code, 2, name)
            self.assertIn("brand:", err)
        cfg = put(self.root, "color.json", '{"colors": ["nope"]}')
        self.assertEqual(run("scan", self.root, "--config", str(cfg))[0], 2)


class ReplaceTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = self._tmp.name
        self.addCleanup(self._tmp.cleanup)

    def mapping(self, data):
        return put(self.root, "mapping.json", json.dumps(data))

    def test_dry_run_changes_nothing(self):
        f = put(self.root, "a.txt", "Acme Inc and ACME\n")
        m = self.mapping({"Acme Inc": "Orbit LLC", "Acme": "Orbit"})
        before = m.read_text()
        code, out, _ = run("replace", self.root, "--map", str(m), "--json")
        rep = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(rep["mode"], "dry-run")
        self.assertEqual(rep["total_replacements"], 2)
        self.assertEqual(f.read_text(), "Acme Inc and ACME\n")
        self.assertEqual(m.read_text(), before)

    def test_apply_longest_first_and_map_preserved(self):
        f = put(self.root, "a.txt", "Acme Inc, acme inc, ACME, acme.com\r\n")
        g = put(self.root, "sub/b.html", "<b>Acme</b>")
        m = self.mapping({"Acme": "Orbit", "Acme Inc": "Orbit LLC"})
        before = m.read_text()
        code, out, _ = run("replace", self.root, "--map", str(m), "--apply", "--json")
        rep = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(rep["mode"], "apply")
        self.assertEqual(f.read_bytes(), b"Orbit LLC, Orbit LLC, Orbit, Orbit.com\r\n")
        self.assertEqual(g.read_text(), "<b>Orbit</b>")
        self.assertEqual(m.read_text(), before)
        self.assertEqual({c["file"] for c in rep["changed_files"]},
                         {"a.txt", os.path.join("sub", "b.html")})

    def test_no_rename_reports_remaining_names(self):
        f = put(self.root, "acme-logo.txt", "x")
        d = put(self.root, "Acme/inner.txt", "x")
        m = self.mapping({"Acme": "Orbit"})
        code, out, _ = run("replace", self.root, "--map", str(m), "--apply", "--json")
        rep = json.loads(out)
        self.assertTrue(f.exists() and d.exists())
        self.assertEqual({r["file"] for r in rep["remaining_names"]},
                         {"acme-logo.txt", "Acme/"})

    def test_skips_binary_non_utf8_symlink_and_exclusions(self):
        blob = put(self.root, "b.bin", b"\0Acme", "wb")
        bad = put(self.root, "bad.txt", b"Acme \xff\xfe", "wb")
        ev = put(self.root, "replica/e.txt", "Acme")
        nm = put(self.root, "node_modules/x.js", "Acme")
        with tempfile.TemporaryDirectory() as outside:
            target = put(outside, "t.txt", "Acme")
            try:
                os.symlink(str(target), os.path.join(self.root, "link.txt"))
            except (OSError, NotImplementedError):
                target = None
            m = self.mapping({"Acme": "Orbit"})
            code, out, _ = run("replace", self.root, "--map", str(m), "--apply", "--json")
            rep = json.loads(out)
            if target is not None:
                self.assertEqual(target.read_text(), "Acme")
        self.assertEqual(blob.read_bytes(), b"\0Acme")
        self.assertEqual(bad.read_bytes(), b"Acme \xff\xfe")
        self.assertEqual(ev.read_text(), "Acme")
        self.assertEqual(nm.read_text(), "Acme")
        reasons = {s["file"]: s["reason"] for s in rep["skipped_files"]}
        self.assertEqual(reasons["bad.txt"], "not-utf8")
        self.assertEqual(reasons["b.bin"], "binary")
        self.assertEqual(rep["changed_files"], [])

    def test_include_evidence(self):
        ev = put(self.root, "replica/e.txt", "Acme")
        m = self.mapping({"Acme": "Orbit"})
        run("replace", self.root, "--map", str(m), "--apply", "--include-evidence")
        self.assertEqual(ev.read_text(), "Orbit")

    def test_invalid_map_and_root(self):
        put(self.root, "a.txt", "Acme")
        missing = os.path.join(self.root, "nope")
        m = self.mapping({"Acme": "Orbit"})
        self.assertEqual(run("replace", missing, "--map", str(m))[0], 2)
        self.assertEqual(run("replace", self.root, "--map",
                             os.path.join(self.root, "missing.json"))[0], 2)
        for name, body in (("empty.json", "{}"), ("list.json", "[]"), ("bad.json", "{"),
                           ("value.json", '{"Acme": 1}'),
                           ("blank.json", '{" ": "x"}'),
                           ("dup.json", '{"Acme": "A", "ACME": "B"}')):
            bad = put(self.root, name, body)
            code, _, err = run("replace", self.root, "--map", str(bad), "--apply")
            self.assertEqual(code, 2, name)
            self.assertIn("brand:", err)
        self.assertEqual((Path(self.root) / "a.txt").read_text(), "Acme")


if __name__ == "__main__":
    unittest.main()

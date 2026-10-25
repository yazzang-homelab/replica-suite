import csv
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "skills/mobile-api-extraction/scripts/catalog_tool.py"
COLS = ["host", "method", "path", "auth", "party", "confidence", "evidence", "request", "response", "notes"]


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


def row(**kw):
    d = dict.fromkeys(COLS, "")
    d.update(kw)
    return d


class CatalogTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def write(self, name, text):
        p = Path(self.tmp.name) / name
        p.write_text(text, encoding="utf-8")
        return str(p)

    def catalog(self, rows):
        buf = io.StringIO()
        w = csv.DictWriter(buf, COLS)
        w.writeheader()
        w.writerows(rows)
        return self.write("c.csv", buf.getvalue())

    def spec(self, rows):
        r = run("openapi", self.catalog(rows))
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout)

    def test_same_path_on_two_hosts_keeps_both(self):
        s = self.spec([
            row(host="a.example.com", method="GET", path="/v1/x", auth="bearer", party="first", confidence="observed", evidence="A.java:1"),
            row(host="b.example.com", method="GET", path="/v1/x", auth="none", party="first", confidence="inferred", evidence="B.java:2"),
        ])
        op = s["paths"]["/v1/x"]["get"]
        self.assertEqual([x["url"] for x in op["servers"]], ["https://a.example.com", "https://b.example.com"])
        self.assertEqual(op["x-evidence"], "A.java:1;B.java:2")
        self.assertEqual(op["x-confidence"], "inferred")
        self.assertTrue(op["x-auth-unknown"])
        self.assertNotIn("security", op)
        self.assertEqual(len(s["servers"]), 2)

    def test_different_methods_and_path_params(self):
        s = self.spec([
            row(host="a.example.com", method="get", path="/u/:id/p/{id}/?token=abc", party="first"),
            row(host="a.example.com", method="DELETE", path="/u/{id}", party="first"),
        ])
        get = s["paths"]["/u/{id}/p/{id}/"]["get"]
        self.assertEqual([p["name"] for p in get["parameters"]], ["id"])
        self.assertIn("delete", s["paths"]["/u/{id}"])
        self.assertNotIn("abc", json.dumps(s))

    def test_unknown_method_skipped_unknown_auth_flagged(self):
        r = run("openapi", self.catalog([
            row(host="a.example.com", method="?", path="/api/a", party="first"),
            row(host="a.example.com", method="FETCH", path="/api/b", party="first"),
            row(host="a.example.com", method="GET", path="/api/c", party="first", confidence="bogus"),
            row(host="t.example.com", method="GET", path="/api/d", party="third"),
        ]))
        self.assertEqual(r.returncode, 0, r.stderr)
        s = json.loads(r.stdout)
        self.assertEqual(list(s["paths"]), ["/api/c"])
        op = s["paths"]["/api/c"]["get"]
        self.assertTrue(op["x-auth-unknown"])
        self.assertEqual(op["x-confidence"], "guess")
        self.assertIn("skipped 3 rows", r.stderr)

    def test_secrets_not_copied(self):
        s = json.dumps(self.spec([row(
            host="a.example.com", method="POST", path="/api/l", party="first",
            notes="uses Bearer abcdefghijklmnop1234", request="password=hunter2 and eyJhbGciOiJI.eyJzdWIiOiIx.c2lnbmF0dXJlMTIz",
            response="AKIAABCDEFGHIJKLMNOP")]))
        for leak in ("abcdefghijklmnop1234", "hunter2", "eyJhbGci", "AKIAABCDEFGHIJKLMNOP"):
            self.assertNotIn(leak, s)

    def test_invalid_catalog_input(self):
        self.assertEqual(run("openapi", str(Path(self.tmp.name) / "missing.csv")).returncode, 2)
        bad = self.write("bad.csv", "foo,bar\n1,2\n")
        r = run("openapi", bad)
        self.assertEqual(r.returncode, 2)
        self.assertIn("missing required", r.stderr)
        r = run("openapi", self.catalog([row(host="bad host/", method="GET", path="/x", party="first")]))
        self.assertEqual(r.returncode, 0)
        self.assertEqual(json.loads(r.stdout)["paths"], {})
        r = run("seed", self.write("e.json", "[1]"))
        self.assertEqual(r.returncode, 2)
        r = run("seed", self.write("n.json", "not json"))
        self.assertEqual(r.returncode, 2)

    def test_unknown_contract_fields_are_not_invented(self):
        s = self.spec([row(method="POST", path="/x", party="first", auth="apikey", request="observed form body")])
        self.assertEqual(s["servers"], [])
        self.assertTrue(s["x-server-unknown"])
        op = s["paths"]["/x"]["post"]
        self.assertNotIn("requestBody", op)
        self.assertNotIn("security", op)
        self.assertEqual(op["x-auth-kind"], "apikey")
        self.assertEqual(op["x-request-evidence"], "observed form body")

    def test_unclassified_party_is_not_assumed_first_party(self):
        s = self.spec([row(host="a.example.com", method="GET", path="/x")])
        self.assertEqual(s["paths"], {})

    def test_seed_unknown_verbs_and_url_hosts(self):
        ex = self.write("e.json", json.dumps({"findings": {
            "endpoint": {"FETCH /api/a?key=s3cr3t": ["a.js:1"], "GET https://h.example.com/v1/b": ["b.js:2"],
                         "HTTP /api/c": ["c.smali:3"]},
            "api_path": {"/api/a": ["a.js:1"]},
            "host": {"x.example.com": [], "y.example.com": []}}}))
        r = run("seed", ex)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertNotIn("s3cr3t", r.stdout)
        rows = {(d["host"], d["method"], d["path"]): d for d in csv.DictReader(io.StringIO(r.stdout))}
        self.assertEqual(set(rows), {("", "?", "/api/a"), ("h.example.com", "GET", "/v1/b"), ("", "?", "/api/c")})
        self.assertEqual(rows[("", "?", "/api/a")]["confidence"], "guess")
        self.assertEqual(rows[("h.example.com", "GET", "/v1/b")]["auth"], "unknown")


if __name__ == "__main__":
    unittest.main()

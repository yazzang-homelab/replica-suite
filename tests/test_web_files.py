import http.server
import importlib.util
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "skills"


def load(rel, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mirror = load("web-mirror-rebrand/scripts/mirror_public_page.py", "mirror_public_page")
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16


class Handler(http.server.BaseHTTPRequestHandler):
    routes = {
        "/": (b'<html><img src="/a.png"><img src="/..%2f..%2fescape.txt"><img src="/x/%2e%2e/%2e%2e/e2.txt"></html>', "text/html"),
        "/a.png": (PNG, "image/png"),
        "/..%2f..%2fescape.txt": (b"evil", "text/plain"),
    }

    def do_GET(self):
        body, ctype = self.routes.get(self.path, (b"nf", "text/plain"))
        self.send_response(200 if self.path in self.routes else 404)
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


class WebFilesTest(unittest.TestCase):
    def setUp(self):
        self.srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.srv.server_port}"
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(self.srv.server_close)
        self.addCleanup(self.srv.shutdown)

    def test_local_path_contained(self):
        root = Path(self.tmp.name).resolve()
        for u in ("http://h/..%2f..%2fx", "http://h/a/%2e%2e/%2e%2e/x", "http://h/..%5c..%5cx", "http://h/a/"):
            dest = mirror.local_path_for(u, root)
            self.assertIn(root, dest.resolve().parents, u)

    def test_mirror_stays_in_output(self):
        out = Path(self.tmp.name) / "out"
        argv = sys.argv
        sys.argv = ["m", self.base + "/", str(out)]
        try:
            self.assertEqual(mirror.main(), 0)
        finally:
            sys.argv = argv
        self.assertEqual((out / "a.png").read_bytes(), PNG)
        self.assertFalse((Path(self.tmp.name) / "escape.txt").exists())
        self.assertFalse((out.parent / "e2.txt").exists())

    def test_mirror_rejects_non_http(self):
        argv = sys.argv
        sys.argv = ["m", "file:///etc/passwd", str(Path(self.tmp.name) / "o")]
        try:
            with self.assertRaises(SystemExit) as cm:
                mirror.main()
            self.assertEqual(cm.exception.code, 2)
        finally:
            sys.argv = argv

    def test_download_assets(self):
        dl = load("web-firecrawl-analyze/scripts/download_assets.py", "download_assets")
        inv = Path(self.tmp.name) / "inv.json"
        inv.write_text(json.dumps({"assets": {"images": [{"url": self.base + "/a.png"}, "bad"]}}))
        dest = Path(self.tmp.name) / "d"
        argv = sys.argv
        sys.argv = ["d", "--inventory", str(inv), "--dest", str(dest), "--delay", "0"]
        try:
            with self.assertRaises(SystemExit) as cm:
                dl.main()
            self.assertEqual(cm.exception.code, 0)
        finally:
            sys.argv = argv
        files = list((dest / "img").glob("a-*.png"))
        self.assertEqual(len(files), 1)
        inv.write_text("[1")
        sys.argv = ["d", "--inventory", str(inv), "--dest", str(dest)]
        try:
            with self.assertRaises(SystemExit) as cm:
                dl.main()
            self.assertEqual(cm.exception.code, 2)
        finally:
            sys.argv = argv


if __name__ == "__main__":
    unittest.main()

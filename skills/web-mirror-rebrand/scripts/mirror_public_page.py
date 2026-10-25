#!/usr/bin/env python3
# Source: Core-Mate/Pixel-Perfect-Web-Replica scripts/mirror_public_page.py
# Commit: 4673cf86f895c4371c32eb9e0963aaed1dec4cac   License: MIT (c) 2026 Core-Mate
# Copied with this header and local hardening (output-path containment, http(s)-only input). Mirrors a PUBLIC same-origin page into a
# static folder + resource-inventory.json + REPLACEABLE_RESOURCES.md.
"""Mirror a public same-origin frontend page into a local static folder."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


ATTR_RE = re.compile(r"""(?:href|src|poster)=['"]?([^'"\s>]+)""", re.I)
CSS_URL_RE = re.compile(r"""url\(([^)]+)\)""", re.I)


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.attrs: list[str] = []
        self.manifests: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        for key in ("href", "src", "poster"):
            if data.get(key):
                self.attrs.append(data[key] or "")
        if tag == "meta" and data.get("content"):
            content = data.get("content") or ""
            if content.startswith(("http://", "https://", "/")):
                self.attrs.append(content)
        if tag == "link" and data.get("rel") and "manifest" in data.get("rel", "") and data.get("href"):
            self.manifests.append(data["href"] or "")


def fetch(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 local-replica-study"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def normalize(base: str, raw: str) -> str | None:
    raw = raw.strip().strip("'\"")
    if not raw or raw.startswith("#") or raw.startswith("data:") or raw.startswith("mailto:") or raw.startswith("tel:"):
        return None
    return urllib.parse.urljoin(base, raw)


def same_origin(a: str, b: str) -> bool:
    pa, pb = urllib.parse.urlparse(a), urllib.parse.urlparse(b)
    return (pa.scheme, pa.netloc) == (pb.scheme, pb.netloc)


def local_path_for(url: str, root: Path) -> Path:
    parsed = urllib.parse.urlparse(url)
    rel = parsed.path.lstrip("/") or "index.html"
    if rel.endswith("/"):
        rel += "index.html"
    parts: list[str] = []
    for part in urllib.parse.unquote(rel).replace("\\", "/").split("/"):
        part = part.replace("\x00", "_")
        if part in ("", "."):
            continue
        parts.append("_" if part == ".." else part)
    dest = root.joinpath(*(parts or ["index.html"]))
    resolved = dest.resolve()
    if resolved != root and root not in resolved.parents:
        raise ValueError(f"resource path escapes output directory: {url}")
    return dest


def detect_file(path: Path) -> str:
    try:
        out = subprocess.check_output(["file", "-b", str(path)], text=True).strip()
        return out
    except Exception:
        return mimetypes.guess_type(path.name)[0] or "unknown"


def extract_urls_from_text(base_url: str, text: str) -> set[str]:
    found: set[str] = set()
    for match in ATTR_RE.finditer(text):
        u = normalize(base_url, match.group(1))
        if u:
            found.add(u)
    for match in CSS_URL_RE.finditer(text):
        u = normalize(base_url, match.group(1))
        if u:
            found.add(u)
    return found


def manifest_icon_urls(base_url: str, manifest_bytes: bytes) -> set[str]:
    try:
        data = json.loads(manifest_bytes.decode("utf-8"))
    except Exception:
        return set()
    urls: set[str] = set()
    for icon in data.get("icons", []):
        if isinstance(icon, dict) and icon.get("src"):
            u = normalize(base_url, str(icon["src"]))
            if u:
                urls.add(u)
    return urls


def category(rel: str) -> str:
    if rel.startswith(("fav/", "font/")):
        return "brand"
    if rel.startswith(("media/hero/", "media/left", "media/right")):
        return "hero"
    if rel.startswith("media/intro/"):
        return "intro"
    if rel.startswith("media/program/"):
        return "program"
    if rel.startswith("media/care/"):
        return "care"
    if rel.startswith("media/shop/"):
        return "shop"
    if rel.startswith("media/video/"):
        return "video"
    if rel.startswith("media/footer/"):
        return "footer"
    if rel.startswith("og/"):
        return "social"
    if rel.endswith((".html", ".css", ".js")):
        return "page"
    return "other"


def write_replaceable(root: Path, inventory: list[dict]) -> None:
    lines = [
        "# Replaceable Resources",
        "",
        "These paths show resources that can be swapped when rebranding.",
        "",
        "| Path | Category | Size | Role / replacement note |",
        "| --- | --- | ---: | --- |",
    ]
    notes = {
        "brand": "Brand asset: replace logos, icons, manifest, or fonts.",
        "hero": "Hero media: replace first-viewport background, phone frame, or app screen video.",
        "intro": "Intro media: replace overview/product montage.",
        "program": "Feature section media: replace screenshots, screen videos, or large scene assets.",
        "care": "Feature/service section media: replace background and phone/service visuals.",
        "shop": "Commerce section media: replace store/order screenshots and large scroll art.",
        "video": "Video cover/background: replace promo cover artwork.",
        "footer": "Footer visual: replace or remove.",
        "social": "Social sharing image: replace with 1200x630 brand image.",
        "page": "Page code/copy: replace text, links, SVG logo symbols, and animation config.",
        "other": "Inspect manually.",
    }
    for item in inventory:
        lines.append(
            f"| `{item['path']}` | {item['category']} | {item['bytes']} | {notes.get(item['category'], 'Inspect manually.')} |"
        )
    (root / "REPLACEABLE_RESOURCES.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Public page URL")
    parser.add_argument("output_dir", help="Output folder")
    parser.add_argument("--overwrite", action="store_true", help="Delete output folder first")
    args = parser.parse_args()

    base_url = args.url
    if urllib.parse.urlparse(base_url).scheme not in ("http", "https") or not urllib.parse.urlparse(base_url).netloc:
        parser.error("url must be an absolute http(s) URL")
    root = Path(args.output_dir).expanduser().resolve()
    if root.exists() and not root.is_dir():
        parser.error(f"output_dir exists and is not a directory: {root}")
    if args.overwrite and root.exists():
        if root == Path(root.anchor):
            parser.error(f"refusing to --overwrite filesystem root: {root}")
        if any(root == p or root in p.parents for p in (Path.home().resolve(), Path.cwd().resolve())):
            parser.error(f"refusing to --overwrite a directory containing home or cwd: {root}")
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)

    html = fetch(base_url)
    (root / "index.html").write_bytes(html)
    html_text = html.decode("utf-8", errors="ignore")

    parser_obj = LinkParser()
    parser_obj.feed(html_text)

    queue = extract_urls_from_text(base_url, html_text)
    for raw in parser_obj.attrs:
        u = normalize(base_url, raw)
        if u:
            queue.add(u)

    base_origin = urllib.parse.urlparse(base_url)
    downloaded: dict[str, str] = {}

    while queue:
        url = queue.pop()
        if not same_origin(base_url, url):
            continue
        parsed = urllib.parse.urlparse(url)
        if parsed.path in ("", "/"):
            continue
        clean_url = urllib.parse.urlunparse(parsed._replace(fragment=""))
        if clean_url in downloaded:
            continue
        try:
            dest = local_path_for(clean_url, root)
        except ValueError as exc:
            print(f"WARN skipped {clean_url}: {exc}", file=sys.stderr)
            continue
        try:
            data = fetch(clean_url)
        except Exception as exc:
            print(f"WARN failed {clean_url}: {exc}", file=sys.stderr)
            continue
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
        except OSError as exc:
            print(f"WARN cannot write {dest}: {exc}", file=sys.stderr)
            continue
        downloaded[clean_url] = str(dest.relative_to(root))
        suffix = dest.suffix.lower()
        text_like = suffix in {".html", ".css", ".js", ".svg", ".json", ".webmanifest"}
        if text_like:
            text = data.decode("utf-8", errors="ignore")
            for nested in extract_urls_from_text(clean_url, text):
                queue.add(nested)
        if suffix in {".json", ".webmanifest"} or dest.name == "manifest.json":
            for icon_url in manifest_icon_urls(clean_url, data):
                queue.add(icon_url)

    inventory = []
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        rel = str(path.relative_to(root))
        if rel in {"resources.json", "resource-inventory.json", "REPLACEABLE_RESOURCES.md"}:
            continue
        inventory.append(
            {
                "path": rel,
                "category": category(rel),
                "bytes": path.stat().st_size,
                "file": detect_file(path),
            }
        )

    (root / "resources.json").write_text(json.dumps(downloaded, indent=2, ensure_ascii=False), encoding="utf-8")
    (root / "resource-inventory.json").write_text(json.dumps(inventory, indent=2, ensure_ascii=False), encoding="utf-8")
    write_replaceable(root, inventory)

    print(f"Mirrored {len(downloaded)} assets into {root}")
    print("Run locally with:")
    print(f"  cd {root}")
    print("  python3 -m http.server 8088")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Download assets listed in an inventory and VERIFY what actually arrived (original, stdlib only).

Input: JSON produced by inventory_page.js (uses assets.images/backgrounds/videos/fonts) or a plain
JSON list of URLs. Output: files under --dest/{img,fonts,video,other}/ and <dest>/assets-map.json
mapping source URL -> local path, content-type, sniffed format, bytes, status.

Why verify: a ".png" URL may return AVIF/WebP/HTML-error; fonts may be 403 HTML. The sniffed format
(magic bytes) is recorded and the file gets the REAL extension; respects --max-mb and a --delay. No cookies/auth are sent.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

MAGIC = [(b"\x89PNG", "png"), (b"\xff\xd8\xff", "jpg"), (b"GIF8", "gif"), (b"wOF2", "woff2"), (b"wOFF", "woff"),
         (b"OTTO", "otf"), (b"\x00\x01\x00\x00", "ttf"), (b"<svg", "svg"), (b"<?xml", "svg"), (b"\x1a\x45\xdf\xa3", "webm")]


def sniff(b):
    for sig, ext in MAGIC:
        if b.startswith(sig):
            return ext
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    if b[4:8] == b"ftyp":
        return "avif" if b[8:12] in (b"avif", b"avis") else "mp4"
    if b.lstrip()[:5].lower() in (b"<!doc", b"<html"):
        return "html-error"
    return "unknown"


def collect(data):
    if isinstance(data, list):
        return [(u, "other") for u in data]
    if not isinstance(data, dict):
        raise ValueError("inventory must be a JSON object or a list of URLs")
    a = data.get("assets", data)
    if not isinstance(a, dict):
        raise ValueError("inventory 'assets' must be an object")
    for key in ("images", "backgrounds", "fonts", "videos"):
        if not isinstance(a.get(key, []), list):
            raise ValueError(f"inventory assets.{key} must be a list")
    out = [(i["url"], "img") for i in a.get("images", []) if isinstance(i, dict) and i.get("url")]
    out += [(u, "img") for u in a.get("backgrounds", [])]
    out += [(u, "fonts") for u in a.get("fonts", [])]
    for v in a.get("videos", []):
        if not isinstance(v, dict):
            continue
        if v.get("url"):
            out.append((v["url"], "video"))
        if v.get("poster"):
            out.append((v["poster"], "img"))
    seen, uniq = set(), []
    for u, k in out:
        if isinstance(u, str) and re.match(r"https?://", u, re.I) and u not in seen:
            seen.add(u)
            uniq.append((u, k))
    return uniq


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inventory", required=True)
    ap.add_argument("--dest", required=True)
    ap.add_argument("--max-mb", type=float, default=50)
    ap.add_argument("--delay", type=float, default=0.2)
    ap.add_argument("--referer", help="send this Referer (some CDNs require the page URL)")
    a = ap.parse_args()
    if a.max_mb <= 0:
        ap.error("--max-mb must be positive")
    if a.delay < 0:
        ap.error("--delay must be >= 0")
    try:
        with open(a.inventory, encoding="utf-8") as f:
            items = collect(json.load(f))
    except (OSError, ValueError) as e:
        ap.error(f"invalid inventory {a.inventory}: {e}")
    amap, bad = [], 0
    for url, kind in items:
        rec = {"url": url, "kind": kind}
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (clone-analysis)", **({"Referer": a.referer} if a.referer else {})})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read(int(a.max_mb * 1048576) + 1)
                rec.update(status=r.status, contentType=r.headers.get("content-type"), bytes=len(body))
            if len(body) > a.max_mb * 1048576:
                rec["status"] = "over-cap"
                bad += 1
            else:
                fmt = sniff(body)
                rec["format"] = fmt
                if fmt == "html-error":
                    bad += 1
                else:
                    name = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(urllib.parse.urlparse(url).path) or "asset")
                    stem = os.path.splitext(name)[0][:60] or "asset"
                    ext = fmt if fmt != "unknown" else (re.sub(r"[^A-Za-z0-9]", "", os.path.splitext(name)[1])[:10] or "bin")
                    sub = {"fonts": "fonts", "video": "video", "img": "img"}.get(kind, "other")
                    path = os.path.join(a.dest, sub, f"{stem}-{hashlib.sha1(url.encode()).hexdigest()[:6]}.{ext}")
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    with open(path, "wb") as f:
                        f.write(body)
                    rec["local"] = path
        except Exception as e:  # network/HTTP failure is data, not a crash
            rec["status"] = f"error: {e}"
            bad += 1
        amap.append(rec)
        time.sleep(a.delay)
    os.makedirs(a.dest, exist_ok=True)
    with open(os.path.join(a.dest, "assets-map.json"), "w", encoding="utf-8") as f:
        json.dump(amap, f, indent=2)
    print(f"{len(amap) - bad}/{len(amap)} assets saved; {bad} failed or invalid -> {os.path.join(a.dest, 'assets-map.json')}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

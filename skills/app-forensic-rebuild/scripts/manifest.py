#!/usr/bin/env python3
"""Seal and verify a mirror ledger (original script for app-forensic-rebuild).

Standard library only. Ideas (immutable mirror, sha256 ledger, ledger-vs-disk
check) follow boyang-hu/website-rebuild-skill; this implementation is original.

    python3 manifest.py seal   mirror/  -o mirror-manifest.json
    python3 manifest.py verify mirror/  -m mirror-manifest.json

seal   writes {path, bytes, sha256} for every file under the directory.
verify exits 1 and lists files that are missing, extra, changed in size or
       content. Run it before every comparison so a polluted mirror is caught.
"""
import argparse
import hashlib
import json
import os
import sys


def walk(root):
    for base, _dirs, files in os.walk(root):
        for name in sorted(files):
            full = os.path.join(base, name)
            if os.path.islink(full):
                continue
            yield os.path.relpath(full, root).replace(os.sep, "/"), full


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def seal(root):
    entries = []
    for rel, full in sorted(walk(root)):
        entries.append({"path": rel, "bytes": os.path.getsize(full), "sha256": digest(full)})
    return {"root": os.path.basename(os.path.abspath(root)), "files": entries}


def verify(root, manifest):
    want = {e["path"]: e for e in manifest["files"]}
    have = dict(walk(root))
    problems = []
    for rel in sorted(set(want) - set(have)):
        problems.append("MISSING  " + rel)
    for rel in sorted(set(have) - set(want)):
        problems.append("EXTRA    " + rel)
    for rel in sorted(set(want) & set(have)):
        full = have[rel]
        if os.path.getsize(full) != want[rel]["bytes"]:
            problems.append("SIZE     " + rel)
        elif digest(full) != want[rel]["sha256"]:
            problems.append("CONTENT  " + rel)
    return problems


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("command", choices=["seal", "verify"])
    ap.add_argument("root")
    ap.add_argument("-o", "--out", default="mirror-manifest.json")
    ap.add_argument("-m", "--manifest", default="mirror-manifest.json")
    args = ap.parse_args()
    if not os.path.isdir(args.root):
        print("not a directory: " + args.root, file=sys.stderr)
        return 2
    if args.command == "seal":
        data = seal(args.root)
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=1)
        print("sealed %d files -> %s" % (len(data["files"]), args.out))
        return 0
    with open(args.manifest, encoding="utf-8") as fh:
        manifest = json.load(fh)
    problems = verify(args.root, manifest)
    for p in problems:
        print(p)
    print("OK: mirror matches ledger" if not problems else "FAIL: %d problem(s)" % len(problems))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

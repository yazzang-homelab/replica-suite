#!/usr/bin/env python3
"""Inspect APK/IPA ZIP members without extracting or executing their contents."""
import argparse
import hashlib
import json
from pathlib import PurePosixPath
import struct
import sys
import zipfile

MAX_ENTRY = 512 * 1024 * 1024
MAX_TOTAL = 2 * 1024 * 1024 * 1024
MAX_MEMBERS = 100000


def inspect(path, max_entry=MAX_ENTRY, max_total=MAX_TOTAL):
    with open(path, "rb") as stream:
        package_hash = hashlib.file_digest(stream, "sha256").hexdigest()
    result = {"sha256": package_hash, "frameworks": [], "artifacts": [],
              "limitations": ["Static inventory only; no signature or runtime verification."]}
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if len(members) > MAX_MEMBERS:
            raise ValueError("Too many archive members")
        if len({item.filename for item in members}) != len(members):
            raise ValueError("Duplicate member names")
        total = 0
        frameworks = set()
        for item in members:
            name = item.filename
            parts = PurePosixPath(name).parts
            if name.startswith("/") or ".." in parts or "\\" in name or ":" in name:
                raise ValueError("Unsafe archive member: " + name)
            mode = (item.external_attr >> 16) & 0o170000
            if mode == 0o120000:
                raise ValueError("Symlink member is not accepted: " + name)
            if item.flag_bits & 1:
                raise ValueError("Encrypted archive member: " + name)
            if item.is_dir():
                continue
            base = parts[-1]
            kind = None
            if base in {"libapp.so", "libflutter.so"} or ".framework/" in name and base in {"App", "Flutter"}:
                kind = "flutter"
                frameworks.add("flutter")
            elif base in {"libil2cpp.so", "UnityFramework", "global-metadata.dat"}:
                kind = "unity-il2cpp"
                frameworks.add("unity-il2cpp")
            elif base in {"index.android.bundle", "main.jsbundle"}:
                kind = "javascript-bundle"
                frameworks.add("react-native-candidate")
            if kind is None:
                continue
            if item.file_size > max_entry:
                raise ValueError("Member exceeds byte limit: " + name)
            digest = hashlib.sha256()
            consumed = 0
            header = b""
            with archive.open(item) as stream:
                while chunk := stream.read(65536):
                    consumed += len(chunk)
                    total += len(chunk)
                    if consumed > max_entry or total > max_total:
                        raise ValueError("Inspection byte budget exceeded")
                    digest.update(chunk)
                    if len(header) < 8:
                        header = (header + chunk)[:8]
            artifact = {"path": name, "kind": kind, "size": consumed,
                        "sha256": digest.hexdigest()}
            if len(parts) >= 3 and parts[0] == "lib":
                artifact["abi"] = parts[1]
            if base == "global-metadata.dat":
                valid = len(header) == 8 and struct.unpack("<I", header[:4])[0] == 0xFAB11BAF
                artifact["metadata_magic_valid"] = valid
                artifact["metadata_version"] = struct.unpack("<I", header[4:])[0] if valid else None
                if not valid:
                    result["limitations"].append("Unknown or truncated metadata header: " + name)
            result["artifacts"].append(artifact)
        result["frameworks"] = sorted(frameworks)
        result["member_count"] = len(members)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package")
    args = parser.parse_args()
    try:
        result = inspect(args.package)
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

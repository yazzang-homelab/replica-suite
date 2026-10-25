#!/usr/bin/env python3
# Portions derived from Jakeschincariol/replica-skill @ 77c9436fb3d18c3d58169efb8caf4fe906b0dc51
# skills/replica-brand|replica-deploy sweep.py (MIT License, Copyright (c) Jake Schincariol);
# see upstream LICENSE. MODIFIED by reverse-anything: merged with the former web-mirror-rebrand
# rebrand_scan.py (original helper) into one CLI with `scan` and `replace` subcommands; the
# traversal now never follows symlinks, config/map files are excluded, colours are validated,
# inputs are validated with explicit errors, and replacement is dry-run by default.
"""Brand scan and literal replace. Standard library only.

    python scripts/brand.py scan ROOT --names "Old,Old Co" --domains old.example \\
        --colors '#123456' [--config brand.json] [--json]
    python scripts/brand.py replace ROOT --map mapping.json [--apply] [--json]

Config (--config): a JSON object with optional string lists "avoid" (names),
"domains" and "colors"; unknown keys are rejected. Config values are merged with
the command-line values. Map (--map): a non-empty JSON object {"old": "new"}.

scan
    Names match case-insensitively anywhere, including inside identifiers, and
    with space/hyphen/underscore variants ("Old Co" also matches OldCo, old-co,
    old_co). Domains match as case-insensitive literals. Colours are normalised
    (#RGB -> #RRGGBB, lower case) and match in either form. File and directory
    names are checked as well as text contents; binary content is not.
    Exit codes: 0 clean, 1 hits, 2 invalid input.
    --json report:
        {"status": "clean" | "hits",
         "root": "<absolute root>",
         "hit_count": <int>,
         "counts": {"<kind>": <int>, ...},
         "hits": [{"file": "<relative path, trailing / for directories>",
                   "line": <int, 0 for path hits>,
                   "kind": "name" | "domain" | "color" | "path",
                   "match": "<configured term or normalised colour>",
                   "text": "<stripped line up to 160 chars | file name | folder name>"}]}

replace
    Longest-key-first, literal, case-insensitive substitution in UTF-8 text files.
    Default is a dry-run; files change only with --apply. Files and directories are
    never renamed; names that still contain a key are reported instead.
    Exit codes: 0 success, 2 invalid input.
    --json report:
        {"mode": "dry-run" | "apply",
         "root": "<absolute root>",
         "total_replacements": <int>,
         "changed_files": [{"file": "<relative path>", "replacements": <int>}],
         "skipped_files": [{"file": "<relative path>", "reason": "not-utf8" | "binary"
                            | "too-large" | "unreadable"}],
         "remaining_names": [{"file": "<relative path>", "match": "<map key>"}]}

Traversal (shared): symlinks are not followed or read, and .git, node_modules, build
output, virtualenv/cache directories and lock files are skipped. A top-level appclone/
or replica/ evidence folder (where the original's name belongs) is skipped unless
--include-evidence is given. The --config and --map files themselves are never scanned
or modified. Files over 2 MB are skipped.
"""

import argparse
import json
import os
import re
import sys

SKIP_DIRS = {".git", "node_modules", ".next", ".nuxt", ".svelte-kit", "dist", "build",
             "out", ".vercel", ".turbo", ".cache", "coverage", "__pycache__", ".venv",
             "venv", ".tox", "Pods", ".expo", "DerivedData", ".gradle"}
EVIDENCE_DIRS = {"appclone", "replica"}
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
              "Podfile.lock", "Cargo.lock", "poetry.lock"}
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".icns", ".pdf", ".zip",
              ".gz", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp4", ".mov", ".mp3",
              ".wav", ".avif", ".heic", ".psd", ".sketch", ".fig", ".jar", ".so", ".dylib"}
HEX = re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])")
MAX_SIZE = 2_000_000
CONFIG_KEYS = {"avoid", "domains", "colors"}


class BrandError(Exception):
    """Invalid input; reported on stderr with exit code 2."""


def norm_hex(value):
    h = value.strip().lower().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return "#" + h


def _split(csv):
    return [x.strip() for x in csv.split(",") if x.strip()]


def _string_list(value, label):
    if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
        raise BrandError("%s must be a list of strings" % label)
    return [x.strip() for x in value if x.strip()]


def _load_json(path, label):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError) as exc:
        raise BrandError("%s %s: %s" % (label, path, exc))


def load_config(path):
    cfg = _load_json(path, "config")
    if not isinstance(cfg, dict):
        raise BrandError("config must be a JSON object")
    unknown = set(cfg) - CONFIG_KEYS
    if unknown:
        raise BrandError("config has unknown keys: %s" % ", ".join(sorted(unknown)))
    if not cfg:
        raise BrandError("config is empty")
    return {k: _string_list(cfg[k], "config." + k) for k in cfg}


def load_map(path):
    raw = _load_json(path, "map")
    if not isinstance(raw, dict):
        raise BrandError("map must be a JSON object of old -> new strings")
    if not raw:
        raise BrandError("map is empty")
    seen = {}
    for key, val in raw.items():
        if not isinstance(key, str) or not key.strip():
            raise BrandError("map keys must be non-empty strings")
        if not isinstance(val, str):
            raise BrandError("map value for %r must be a string" % key)
        folded = key.casefold()
        if folded in seen:
            raise BrandError("map keys %r and %r differ only by case" % (seen[folded], key))
        seen[folded] = key
    return dict(raw)


def build_patterns(names, domains):
    pats = []
    for name in dict.fromkeys(names):
        # "Acuity Scheduling" also matches AcuityScheduling and acuity-scheduling
        parts = [re.escape(p) for p in re.split(r"[\s_-]+", name) if p]
        if not parts:
            raise BrandError("name %r has no searchable characters" % name)
        pats.append(("name", name, re.compile(r"[\s_-]?".join(parts), re.I)))
    for d in dict.fromkeys(x.lower() for x in domains):
        pats.append(("domain", d, re.compile(re.escape(d), re.I)))
    return pats


def is_binary(path):
    if os.path.splitext(path)[1].lower() in BINARY_EXT:
        return True
    try:
        with open(path, "rb") as fh:
            return b"\0" in fh.read(4096)
    except OSError:
        return True


def check_root(root):
    if not os.path.isdir(root):
        raise BrandError("root is not a directory: %s" % root)
    return os.path.abspath(root)


def walk(root, include_evidence=False, excluded=()):
    """Yield (rel_path, abs_path, is_dir, is_symlink) for every entry, not following symlinks.

    Symlinked directories are yielded (their name may match) but never descended into.
    Excluded abs real paths (config/map) and lock files are not yielded.
    """
    excluded = {os.path.realpath(p) for p in excluded}
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        rel_dir = os.path.relpath(dirpath, root)
        keep = []
        for d in sorted(dirnames):
            if d in SKIP_DIRS:
                continue
            if d in EVIDENCE_DIRS and rel_dir == "." and not include_evidence:
                continue
            keep.append(d)
        dirnames[:] = [d for d in keep if not os.path.islink(os.path.join(dirpath, d))]
        for d in keep:
            full = os.path.join(dirpath, d)
            yield (os.path.normpath(os.path.join(rel_dir, d)), full, True,
                   os.path.islink(full))
        for fn in sorted(filenames):
            if fn in SKIP_FILES:
                continue
            full = os.path.join(dirpath, fn)
            if os.path.realpath(full) in excluded:
                continue
            yield (os.path.normpath(os.path.join(rel_dir, fn)), full, False,
                   os.path.islink(full))


def _read_text_lines(path):
    try:
        if os.path.getsize(path) > MAX_SIZE or is_binary(path):
            return None
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.readlines()
    except OSError:
        return None


def scan(root, names=(), domains=(), colors=(), include_evidence=False, excluded=()):
    pats = build_patterns(names, domains)
    cols = set()
    for c in colors:
        if not HEX.fullmatch(c.strip()):
            raise BrandError("invalid colour %r (use #rgb or #rrggbb)" % c)
        cols.add(norm_hex(c))
    hits = []
    for rel, full, is_dir, is_link in walk(root, include_evidence, excluded):
        base = os.path.basename(rel)
        for kind, label, rx in pats:
            if kind == "name" and rx.search(base):
                hits.append({"file": rel + "/" if is_dir else rel, "line": 0, "kind": "path",
                             "match": label,
                             "text": "folder name" if is_dir else "file name"})
        if is_dir or is_link:
            continue
        lines = _read_text_lines(full)
        if lines is None:
            continue
        for i, line in enumerate(lines, 1):
            text = line.strip()[:160]
            for kind, label, rx in pats:
                if rx.search(line):
                    hits.append({"file": rel, "line": i, "kind": kind, "match": label,
                                 "text": text})
            if cols:
                for m in HEX.finditer(line):
                    if norm_hex(m.group(0)) in cols:
                        hits.append({"file": rel, "line": i, "kind": "color",
                                     "match": norm_hex(m.group(0)), "text": text})
    return hits


def scan_report(root, hits):
    counts = {}
    for h in hits:
        counts[h["kind"]] = counts.get(h["kind"], 0) + 1
    return {"status": "hits" if hits else "clean", "root": root, "hit_count": len(hits),
            "counts": dict(sorted(counts.items())), "hits": hits}


def render_scan(report):
    if not report["hits"]:
        return "Clean. Nothing of the original's name, domain or colours found."
    out = []
    for h in report["hits"]:
        loc = h["file"] if not h["line"] else "%s:%d" % (h["file"], h["line"])
        out.append("%-7s %-18s %s  %s" % (h["kind"], h["match"][:18], loc, h["text"]))
    out.append("")
    out.append("%d hits (%s). Replace every one before you launch."
               % (report["hit_count"],
                  ", ".join("%s %d" % kv for kv in report["counts"].items())))
    return "\n".join(out)


def replace(root, mapping, apply=False, include_evidence=False, excluded=()):
    keys = sorted(mapping, key=len, reverse=True)
    rx = re.compile("|".join(re.escape(k) for k in keys), re.I)
    lower_map = {k.lower(): v for k, v in mapping.items()}
    changed, skipped, remaining = [], [], []
    total = 0
    for rel, full, is_dir, is_link in walk(root, include_evidence, excluded):
        m = rx.search(os.path.basename(rel))
        if m:
            remaining.append({"file": rel + "/" if is_dir else rel,
                              "match": lower_key(mapping, m.group(0))})
        if is_dir or is_link:
            continue
        try:
            if os.path.getsize(full) > MAX_SIZE:
                skipped.append({"file": rel, "reason": "too-large"})
                continue
            if is_binary(full):
                skipped.append({"file": rel, "reason": "binary"})
                continue
            with open(full, "rb") as fh:
                data = fh.read()
        except OSError:
            skipped.append({"file": rel, "reason": "unreadable"})
            continue
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            skipped.append({"file": rel, "reason": "not-utf8"})
            continue
        new, n = rx.subn(lambda mm: lower_map[mm.group(0).lower()], text)
        if not n or new == text:
            continue
        total += n
        changed.append({"file": rel, "replacements": n})
        if apply:
            try:
                with open(full, "wb") as fh:
                    fh.write(new.encode("utf-8"))
            except OSError as exc:
                raise BrandError("cannot write %s: %s" % (rel, exc))
    return {"mode": "apply" if apply else "dry-run", "root": root, "total_replacements": total,
            "changed_files": changed, "skipped_files": skipped, "remaining_names": remaining}


def lower_key(mapping, matched):
    folded = matched.casefold()
    for k in mapping:
        if k.casefold() == folded:
            return k
    return matched


def render_replace(report):
    out = ["%s: %d replacements in %d files" % (report["mode"], report["total_replacements"],
                                              len(report["changed_files"]))]
    for c in report["changed_files"]:
        out.append("  %s (%d)" % (c["file"], c["replacements"]))
    for s in report["skipped_files"]:
        out.append("  skipped %s (%s)" % (s["file"], s["reason"]))
    for r in report["remaining_names"]:
        out.append("  name still matches [%s]: %s (not renamed)" % (r["match"], r["file"]))
    if report["mode"] == "dry-run":
        out.append("Dry run: nothing written. Re-run with --apply to change files.")
    else:
        out.append("APPLIED replacements; re-run scan and QA.")
    return "\n".join(out)


def build_parser():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="command", required=True)
    sc = sub.add_parser("scan", help="report remaining names, domains, colours, paths")
    sc.add_argument("root")
    sc.add_argument("--names", default="", help="comma-separated original names")
    sc.add_argument("--domains", default="", help="comma-separated domains")
    sc.add_argument("--colors", default="", help="comma-separated hex colours")
    sc.add_argument("--config", help="JSON with avoid / domains / colors lists")
    sc.add_argument("--include-evidence", action="store_true")
    sc.add_argument("--json", action="store_true")
    rp = sub.add_parser("replace", help="literal longest-first replacement (dry-run default)")
    rp.add_argument("root")
    rp.add_argument("--map", required=True, help="JSON object old -> new")
    rp.add_argument("--apply", action="store_true")
    rp.add_argument("--include-evidence", action="store_true")
    rp.add_argument("--json", action="store_true")
    return ap


def run(args):
    root = check_root(args.root)
    if args.command == "scan":
        names, domains, colors = _split(args.names), _split(args.domains), _split(args.colors)
        excluded = []
        if args.config:
            cfg = load_config(args.config)
            names += cfg.get("avoid", [])
            domains += cfg.get("domains", [])
            colors += cfg.get("colors", [])
            excluded.append(args.config)
        if not (names or domains or colors):
            raise BrandError("nothing to look for: pass --names, --domains, --colors or --config")
        report = scan_report(root, scan(root, names, domains, colors,
                                        args.include_evidence, excluded))
        print(json.dumps(report, indent=2) if args.json else render_scan(report))
        return 1 if report["hits"] else 0
    mapping = load_map(args.map)
    report = replace(root, mapping, args.apply, args.include_evidence, [args.map])
    print(json.dumps(report, indent=2) if args.json else render_replace(report))
    return 0


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return run(args)
    except BrandError as exc:
        print("brand: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

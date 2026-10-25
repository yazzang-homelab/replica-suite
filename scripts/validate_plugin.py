#!/usr/bin/env python3
"""Check manifests, skill metadata, local links, provenance and script syntax."""
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit

import yaml

ROOT = Path(__file__).resolve().parents[1]


def validate(root=ROOT):
    errors = []
    plugin = json.loads((root / ".claude-plugin/plugin.json").read_text())
    market = json.loads((root / ".claude-plugin/marketplace.json").read_text())
    package = json.loads((root / "package.json").read_text())
    if plugin["name"] != package["name"] or plugin["version"] != package["version"]:
        errors.append("Plugin/package identity mismatch")
    if not package.get("private"):
        errors.append("npm package must be private")
    if market["plugins"][0]["name"] != plugin["name"] or market["plugins"][0]["source"] != "./":
        errors.append("Marketplace must point to this local plugin")
    skills = sorted((root / "skills").glob("*/SKILL.md"))
    names = {p.parent.name for p in skills}
    required = {"replica", "app-index", "web-index", "shot-index", "mobile-index", "native-index"}
    if required - names:
        errors.append("Missing routers: " + str(required - names))
    for path in skills:
        text = path.read_text()
        pieces = text.split("---", 2)
        try:
            meta = yaml.safe_load(pieces[1]) if text.startswith("---\n") and len(pieces) == 3 else None
            if not isinstance(meta, dict) or meta.get("name") != path.parent.name:
                raise ValueError("name must match skill directory")
            if not isinstance(meta.get("description"), str) or not meta["description"].strip():
                raise ValueError("description is required")
        except (ValueError, yaml.YAMLError) as exc:
            errors.append(f"{path.relative_to(root)}: invalid metadata: {exc}")
        if len(text.splitlines()) > 200:
            errors.append(f"{path.relative_to(root)}: exceeds 200 lines")
        if "## Sources" not in text:
            errors.append(f"{path.relative_to(root)}: missing Sources")
        for name in re.findall(r"`((?:app|web|shot|mobile|native)-[a-z0-9-]+)`", text):
            if name not in names and not name.endswith("-"):
                errors.append(f"{path.relative_to(root)}: unresolved skill {name}")
    for name in required:
        router = root / "skills" / name / "SKILL.md"
        if router.exists() and "../../references/common-contract.md" not in router.read_text():
            errors.append(f"{name}: missing shared execution contract")
    for retired in ("skills/app-brand-deploy/scripts/sweep.py", "skills/web-mirror-rebrand/scripts/rebrand_scan.py"):
        if (root / retired).exists():
            errors.append(f"Retired duplicate remains: {retired}")
    browser_consumers = (
        "shot-compare-iterate/scripts/shot.mjs", "shot-compare-iterate/scripts/capture_visual_qa.mjs",
        "shot-to-rn/scripts/rn-verify.mjs", "web-verify-pixel/scripts/capture_matrix.mjs",
        "web-webgl/scripts/runtime-qa.mjs", "web-webgl/scripts/capture_runtime_mirror.mjs",
    )
    for relative in browser_consumers:
        path = root / "skills" / relative
        if not path.is_file() or "../../../lib/browser.mjs" not in path.read_text():
            errors.append(f"{relative}: missing shared browser implementation")
    for relative in ("app-parity-test/scripts/imgdiff.py", "web-verify-pixel/scripts/pixel_diff.py"):
        path = root / "skills" / relative
        text = path.read_text() if path.is_file() else ""
        if "from lib.images import" not in text or "import zlib" in text:
            errors.append(f"{relative}: image I/O is not consolidated")
    documents = [p for base in (root / "skills", root / "references") for p in base.rglob("*.md")]
    for path in documents:
        if any(old in path.read_text() for old in ("scripts/sweep.py", "scripts/rebrand_scan.py")):
            errors.append(f"{path.relative_to(root)}: retired brand command reference")
        for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", path.read_text()):
            if urlsplit(target).scheme or target.startswith(("#", "//")) or "<" in target:
                continue
            local = unquote(target.split("#", 1)[0])
            if local and not (path.parent / local).exists():
                errors.append(f"{path.relative_to(root)}: missing link {target}")
    scripts = [p for base in (root / "scripts", root / "skills", root / "lib", root / "tests") for p in base.rglob("*")
               if p.is_file() and p.suffix in {".py", ".sh", ".js", ".mjs"}]
    for path in scripts:
        if path.suffix == ".py":
            try:
                ast.parse(path.read_text(), filename=str(path))
            except SyntaxError as exc:
                errors.append(str(exc))
        else:
            command = ["bash", "-n", str(path)] if path.suffix == ".sh" else ["node", "--check", str(path)]
            result = subprocess.run(command, capture_output=True, text=True)
            if result.returncode:
                errors.append(f"{path.relative_to(root)}: {result.stderr}")
    catalog = json.loads((root / "upstreams.lock.json").read_text())["repositories"]
    if len(catalog) != 40 or {r["id"] for r in catalog} != set(range(1, 41)):
        errors.append("Provenance must account for all 40 requested repositories")
    notices = (root / "THIRD_PARTY_NOTICES.txt").read_text()
    for repo in catalog:
        if repo["status"] == "unavailable":
            if repo["skills"]:
                errors.append(repo["repository"] + ": unavailable repository claimed as integrated")
            continue
        if not re.fullmatch(r"[0-9a-f]{40}", repo["commit"]):
            errors.append(repo["repository"] + ": missing exact source commit")
        if not repo["skills"]:
            errors.append(repo["repository"] + ": no integration mapping")
        if set(repo["skills"]) - names:
            errors.append(repo["repository"] + ": missing mapped skill")
        if repo["bundled_files"] and repo["repository"] not in notices:
            errors.append(repo["repository"] + ": missing third-party license notice")
        for item in repo["bundled_files"]:
            path = root / item["path"]
            if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != item["sha256"]:
                errors.append(item["path"] + ": provenance hash mismatch; regenerate catalog after review")
    return errors, {"skills": len(skills), "scripts": len(scripts), "sources": len(catalog)}


def main():
    errors, counts = validate()
    print(json.dumps({"status": "FAIL" if errors else "PASS", **counts, "errors": errors}, ensure_ascii=False, indent=2))
    return bool(errors)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Install in isolated settings and verify native skill discovery without model calls.

Requires the selected client executables. No credentials, existing client settings,
production repositories or global plugin registrations are modified. Temporary
bundles exclude caches, virtualenvs, node_modules and Git history. This verifies
installation/discovery and shared-resource integrity, not model behavior parity.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ID = "replica-suite@replica-suite-local"
CLIENTS = ("codex", "claude", "gjc")
BUNDLE_DIRS = (".agents", ".claude-plugin", "skills", "lib", "scripts", "references", "tests")
BUNDLE_FILES = ("plugin.json", "package.json", "package-lock.json", "requirements.txt", "LICENSE",
                "THIRD_PARTY_NOTICES.txt", "upstreams.lock.json", "AGENTS.md",
                "README.md", "README.ko.md", "README.zh-CN.md", "README.ja.md")


def stage_bundle(source, destination):
    destination.mkdir()
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", "node_modules", ".venv", ".git")
    for name in BUNDLE_DIRS:
        shutil.copytree(source / name, destination / name, ignore=ignore)
    for name in BUNDLE_FILES:
        shutil.copy2(source / name, destination / name)


def isolated_env(home):
    home.mkdir(parents=True)
    codex = home / ".codex"
    claude = home / ".claude"
    gjc = home / ".gjc/agent"
    for directory in (codex, claude, gjc):
        directory.mkdir(parents=True)
    env = {key: value for key, value in os.environ.items()
           if not key.endswith("API_KEY") and key not in {
               "ANTHROPIC_AUTH_TOKEN", "OPENAI_ACCESS_TOKEN", "GH_TOKEN", "GITHUB_TOKEN",
               "CLAUDE_CODE_OAUTH_TOKEN", "CODEX_HOME", "CLAUDE_CONFIG_DIR", "GJC_CODING_AGENT_DIR"}}
    env.update(HOME=str(home), CODEX_HOME=str(codex), CLAUDE_CONFIG_DIR=str(claude),
               GJC_CODING_AGENT_DIR=str(gjc), XDG_CONFIG_HOME=str(home / ".config"),
               XDG_CACHE_HOME=str(home / ".cache"), DISABLE_AUTOUPDATER="1",
               GIT_TERMINAL_PROMPT="0", NO_COLOR="1")
    return env


def run(executable, args, env, cwd, timeout=90):
    result = subprocess.run([executable, *args], env=env, cwd=cwd, capture_output=True,
                            text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"{Path(executable).name} {' '.join(args)} failed ({result.returncode}):\n"
                           + result.stderr + result.stdout)
    if result.stderr.strip():
        print(result.stderr.rstrip(), file=sys.stderr)
    return result.stdout


def verify_resources(installed, source, names):
    installed = Path(installed).resolve()
    expected = {"skills/" + name + "/SKILL.md" for name in names}
    expected.update({"lib/browser.mjs", "lib/images.py", "scripts/brand.py", "scripts/inspect_mobile.py",
                     "references/common-contract.md", "references/runtime.md", "package.json"})
    for relative in sorted(expected):
        path = installed / relative
        if not path.is_file():
            raise AssertionError(f"Installed bundle missing {relative}")
        if hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256((source / relative).read_bytes()).digest():
            raise AssertionError(f"Installed bundle differs at {relative}")
    result = subprocess.run([sys.executable, str(installed / "scripts/brand.py"), "--help"],
                            cwd=installed.parent, capture_output=True, text=True, timeout=15)
    if result.returncode or "scan" not in result.stdout or "replace" not in result.stdout:
        raise AssertionError("Installed shared CLI cannot run from another working directory")


def codex_skills(executable, env, cwd):
    with tempfile.TemporaryFile(mode="w+") as stderr:
        process = subprocess.Popen([executable, "app-server", "--listen", "stdio://"],
                                   cwd=cwd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=stderr, text=True, bufsize=1)
        messages = queue.Queue()

        def read_output():
            for line in process.stdout:
                messages.put(line)
            messages.put(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()

        def send(message):
            process.stdin.write(json.dumps(message) + "\n")
            process.stdin.flush()

        def receive(request_id):
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                try:
                    line = messages.get(timeout=max(0.01, deadline - time.monotonic()))
                except queue.Empty as exc:
                    raise TimeoutError("Codex app-server response timed out") from exc
                if line is None:
                    raise RuntimeError("Codex app-server exited before responding")
                message = json.loads(line)
                if message.get("id") == request_id:
                    if "error" in message:
                        raise RuntimeError(str(message["error"]))
                    return message["result"]
            raise TimeoutError("Codex app-server response timed out")

        try:
            send({"id": 1, "method": "initialize", "params": {
                "clientInfo": {"name": "replica_suite_check", "version": "0.3.0"}}})
            receive(1)
            send({"method": "initialized", "params": {}})
            send({"id": 2, "method": "skills/list", "params": {"cwds": [str(cwd)], "forceReload": True}})
            result = receive(2)
            skills = []
            for group in result["data"]:
                if group.get("errors"):
                    raise AssertionError(f"Codex skill discovery errors: {group['errors']}")
                skills.extend(skill for skill in group["skills"] if skill.get("pluginId") == PLUGIN_ID)
            return skills
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            reader.join(timeout=2)
            process.stdin.close()
            process.stdout.close()


def check_codex(executable, source, env, cwd, names):
    run(executable, ["plugin", "marketplace", "add", str(source), "--json"], env, cwd)
    result = json.loads(run(executable, ["plugin", "add", PLUGIN_ID, "--json"], env, cwd))
    installed = Path(result["installedPath"])
    listing = json.loads(run(executable, ["plugin", "list", "--json"], env, cwd))
    if not any(item["pluginId"] == PLUGIN_ID and item["enabled"] for item in listing["installed"]):
        raise AssertionError("Codex did not enable the installed plugin")
    skills = codex_skills(executable, env, cwd)
    if {s["name"] for s in skills if s["enabled"]} != {"replica-suite:" + n for n in names}:
        raise AssertionError("Codex discovered skill set differs from the bundle")
    for skill in skills:
        if Path(skill["path"]).resolve().parents[2] != installed.resolve():
            raise AssertionError("Codex skill path does not preserve the shared bundle root")
    verify_resources(installed, source, names)
    return {"skills": len(skills), "discovery": "app-server skills/list"}


def check_claude(executable, source, env, cwd, names):
    run(executable, ["plugin", "marketplace", "add", str(source)], env, cwd)
    run(executable, ["plugin", "install", PLUGIN_ID], env, cwd)
    details = run(executable, ["plugin", "details", PLUGIN_ID], env, cwd)
    count = re.search(r"Skills\s*\((\d+)\)", details)
    if not count or int(count.group(1)) != len(names):
        raise AssertionError("Claude skill inventory does not match the bundle")
    for name in names:
        if not re.search(r"(?<![\w-])" + re.escape(name) + r"(?![\w-])", details):
            raise AssertionError(f"Claude inventory missing skill {name}")
    registry = json.loads(run(executable, ["plugin", "list", "--json"], env, cwd))
    entries = [item for item in registry if item["id"] == PLUGIN_ID]
    if len(entries) != 1 or not entries[0]["enabled"]:
        raise AssertionError("Expected one isolated Claude installation")
    verify_resources(Path(entries[0]["installPath"]), source, names)
    if entries[0].get("readFromFolder"):
        verify_resources(Path(entries[0]["readFromFolder"]), source, names)
    return {"skills": len(names), "discovery": "plugin details component inventory"}


def check_gjc(executable, source, env, cwd, names):
    run(executable, ["plugin", "marketplace", "add", str(source)], env, cwd)
    run(executable, ["plugin", "install", PLUGIN_ID, "--scope", "user"], env, cwd)
    listing = json.loads(run(executable, ["plugin", "list", "--json"], env, cwd))
    entries = [item for item in listing["marketplace"] if item["id"] == PLUGIN_ID]
    if len(entries) != 1 or len(entries[0]["entries"]) != 1:
        raise AssertionError("Expected one isolated GJC marketplace installation")
    installed = Path(entries[0]["entries"][0]["installPath"])
    discovery = json.loads(run(executable, ["skills", "discover", "--query", "replica-suite",
                                            "--limit", "50", "--json"], env, cwd))
    if discovery.get("diagnostics"):
        raise AssertionError(f"GJC skill discovery diagnostics: {discovery['diagnostics']}")
    if {s["name"] for s in discovery["candidates"]} != {"replica-suite:" + n for n in names}:
        raise AssertionError("GJC discovered skill set differs from the bundle")
    for skill in discovery["candidates"]:
        if Path(skill["path"]).resolve().parents[2] != installed.resolve():
            raise AssertionError("GJC skill path does not preserve the shared bundle root")
    verify_resources(installed, source, names)
    return {"skills": len(names), "discovery": "skills discover marketplace provider"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client", choices=("all", *CLIENTS), default="all")
    args = parser.parse_args()
    selected = CLIENTS if args.client == "all" else (args.client,)
    executables = {name: shutil.which(name) for name in selected}
    missing = [name for name, path in executables.items() if path is None]
    if missing:
        parser.error("Required client executables are missing: " + ", ".join(missing))
    names = {p.parent.name for p in (ROOT / "skills").glob("*/SKILL.md")}
    reports = []
    checks = {"codex": check_codex, "claude": check_claude, "gjc": check_gjc}
    # Codex refuses helper executables under /tmp; use an isolated user cache instead.
    cache = Path.home() / ".cache"
    cache.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="replica-client-check-", dir=cache) as temp:
        base = Path(temp)
        source = base / "bundle"
        stage_bundle(ROOT, source)
        for client in selected:
            env = isolated_env(base / client)
            cwd = base / client
            version = run(executables[client], ["--version"], env, cwd).strip()
            result = checks[client](executables[client], source, env, cwd, names)
            reports.append({"client": client, "version": version, "status": "PASS", **result})
    print(json.dumps({"status": "PASS", "clients": reports,
                      "limits": "Installation/discovery and shared-resource checks only; no model turns or native-device tests."},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, AssertionError, RuntimeError, subprocess.SubprocessError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

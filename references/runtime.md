# Portable runtime and path resolution

These skills share one installed bundle across clients. Do not copy individual skill folders: `lib/`, root `scripts/`, `references/`, manifests and dependency files must remain beside `skills/`.

## Find the installed bundle

Use the absolute `SKILL.md` path reported by the client. Resolve symlinks first; the bundle root is three parent directories above the file (`Path(skill_file).resolve().parents[2]`). Do not infer it from the target project's working directory or from a fixed user home.

For shell examples, explicitly define `REPLICA_SUITE_ROOT` as that absolute bundle root. This is a variable set by you, **not** an environment variable promised by Codex, Claude Code or GJC. Set it in the same shell invocation, or pass it through the host tool's environment field. Do not assume one tool call's exported variables survive the next call.

```bash
# Run with the absolute SKILL.md path provided by your client.
export REPLICA_SUITE_ROOT="$(python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).resolve().parents[2])' /absolute/path/to/skills/replica/SKILL.md)"
python3 "$REPLICA_SUITE_ROOT/scripts/inspect_mobile.py" /absolute/path/to/app.apk
```

The example path must be replaced with the real selected skill path. A missing path is a setup error, not permission to guess another checkout.

## Resolve commands and resources

- A `scripts/...` command inside an individual skill refers to that skill directory unless it explicitly uses `$REPLICA_SUITE_ROOT/scripts/...`.
- Markdown links are relative to the document that contains them, not to the target project.
- Pass input/output paths as absolute paths when invoking tools from another directory.
- Python consumers locate shared `lib/images.py` from their own file path. Browser consumers import `lib/browser.mjs` relative to their own module; they do not load Playwright from the target application's dependencies.
- Do not rely on client-specific root variables or on the spelling of a skill's invocation command to find resources.

## Install dependencies in the actual installed bundle

Client plugin managers may copy the bundle into a cache. Preparing dependencies only in the source clone does not prepare a separate cache. Use the installed path returned by the plugin manager or resolved from the selected skill.

For Claude local marketplaces, `claude plugin list --json` may return `readFromFolder` as well as `installPath`. When present, `readFromFolder` is the active source directory and takes precedence for dependency setup. Codex returns `installedPath` during installation; GJC lists `entries[].installPath` in `gjc plugin list --json`. The selected skill's canonical path remains the authoritative cross-client check.

```bash
npm ci --prefix "$REPLICA_SUITE_ROOT"
python3 -m venv "$REPLICA_SUITE_ROOT/.venv"
"$REPLICA_SUITE_ROOT/.venv/bin/python" -m pip install -r "$REPLICA_SUITE_ROOT/requirements.txt"
node "$REPLICA_SUITE_ROOT/node_modules/playwright/cli.js" install chromium
```

Use `"$REPLICA_SUITE_ROOT/.venv/bin/python"` for Python image/validation tools. Stdlib-only tools can use system Python 3.13. On Windows, the virtualenv interpreter is `.venv/Scripts/python.exe`; the bundled `.sh` mobile helpers require a POSIX shell. Ghidra, jadx, apktool, Frida, Qt and platform SDKs are separate optional tools, not auto-installed by this plugin.

No install hooks run these commands automatically. Respect the user's installation policy. A client updating its cache may require dependency setup again. Native device analysis and Qt/Ghidra execution need their own validation; plugin discovery and browser tests do not prove those integrations work.

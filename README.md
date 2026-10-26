# replica-suite

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

<p align="center"><a href="https://raw.githubusercontent.com/yazzang-homelab/replica-suite/assets/demo.mp4"><img src="https://raw.githubusercontent.com/yazzang-homelab/replica-suite/assets/demo.webp" alt="replica-suite in 18 seconds: web, screenshot, mobile and native skills, evidence to spec to build to verify, one install for Claude Code, Codex and GJC" width="100%"></a></p>
<p align="center"><sub>18 s overview. Click for the 1080p MP4 with sound. Rendered in code with <a href="https://github.com/yazzang-homelab/motion-studio">motion-studio</a>.</sub></p>

Version 0.3.0. One set of 41 shared skills for app and website reconstruction, installable in Codex, Claude Code and GJC. The workflow is evidence, then spec, then build, then verify.

Repository: https://github.com/yazzang-homelab/replica-suite. Plugin name: `replica-suite`. Marketplace ID: `replica-suite-local`.

## What this is

An agent-skill bundle for porting or re-implementing apps and sites. It covers:

- Web: HTML, React, Vue, Svelte, React Native, UnoCSS, QML output from captures or screenshots.
- Mobile packages: APK, IPA, Flutter, Unity.
- Native: Ghidra, native binaries, C++ reconstruction, porting games to the web.

It is not a one-click tool that clones any app. Skills guide an agent through gathering evidence, writing a spec, building and verifying; results depend on the target, the model and your own review.

## Skills (41)

| Category    | Count | Router skill   |
| ----------- | ----- | -------------- |
| app         | 8     | `app-index`    |
| web         | 10    | `web-index`    |
| shot        | 8     | `shot-index`   |
| mobile      | 7     | `mobile-index` |
| native      | 7     | `native-index` |
| root router | 1     | `replica`      |

One copy of the skills is shared by all three clients. `lib/`, `scripts/` and `references/` sit beside `skills/` and are shared too. Do not copy individual skill folders out of the bundle.

## Prerequisites

- Git or `gh` CLI installed.
- Node 22 recommended (>=20), Python 3.13 recommended, git.
- OS-specific tools (Ghidra, jadx, apktool, Frida, Qt, platform SDKs) are external and optional; they are not installed by the plugin.

Clone (optional unless installing from a local path):

```bash
git clone https://github.com/yazzang-homelab/replica-suite.git
```

## Install

In each client you may use `yazzang-homelab/replica-suite` or an absolute local clone path. Start a new session after installation.

### Claude Code

```bash
claude plugin marketplace add yazzang-homelab/replica-suite
claude plugin install replica-suite@replica-suite-local
claude plugin list --json
```

Start a new session and run `/replica-suite:replica`.

Local test without installing:

```bash
claude --plugin-dir /absolute/path/to/replica-suite
```

### Codex

Codex uses the root `plugin.json` (Agent Plugins 1.0 portable manifest) and `.agents/plugins/marketplace.json`. There is no `.codex-plugin` fallback.

```bash
codex plugin marketplace add yazzang-homelab/replica-suite
codex plugin add replica-suite@replica-suite-local
codex plugin list --json
```

In a new session, open `/skills` or the `$` picker and choose `replica-suite:replica`.

### GJC

GJC reads this repository through its Claude-compatible marketplace provider. Do not use the newer `gajae-plugin.json` bundle format (it does not support top-level skills), and do not use `gjc plugin install .` or the bundle `--user` route.

```bash
gjc plugin marketplace add yazzang-homelab/replica-suite
gjc plugin install replica-suite@replica-suite-local --scope user
gjc plugin list --json
gjc skills discover --query replica-suite --limit 50 --json
```

Discovery reported 41 candidates on GJC 0.19.0. In a new session run `/skill:replica-suite:replica`. `--dry-run` is ignored by marketplace install in this version; do not use it to verify an install.

### Installing from a local clone

All three clients accept an absolute clone path in `marketplace add`. GJC copies the whole directory, so use a clean checkout without `node_modules` or `.venv`, then prepare dependencies in the installed copy.

## Dependencies in the installed bundle

Plugin managers may copy the bundle into a cache. Installing dependencies only in your clone does not affect that cache. Find the real root from the selected `SKILL.md` (`root = Path(skill).resolve().parents[2]`) or from the plugin manager's `installedPath`/`installPath`.

For a Claude local marketplace, `readFromFolder` in `claude plugin list --json` takes precedence over `installPath`: install dependencies where the active skill is actually read.

`REPLICA_SUITE_ROOT` is a variable you set yourself; it is not provided by any host. Set it in the same shell invocation that uses it.

```bash
export REPLICA_SUITE_ROOT="/absolute/path/to/installed/bundle"
npm ci --prefix "$REPLICA_SUITE_ROOT"
python3 -m venv "$REPLICA_SUITE_ROOT/.venv"
"$REPLICA_SUITE_ROOT/.venv/bin/python" -m pip install -r "$REPLICA_SUITE_ROOT/requirements.txt"
node "$REPLICA_SUITE_ROOT/node_modules/playwright/cli.js" install chromium
```

No hook installs tools automatically. A cache update may require repeating this. Details: [references/runtime.md](references/runtime.md).

## Usage

Start from `replica`, or call a category router directly: `app-index`, `web-index`, `shot-index`, `mobile-index`, `native-index`. The prefix follows the host (`/replica-suite:web-index` in Claude Code, `replica-suite:web-index` in the Codex picker, `/skill:replica-suite:web-index` in GJC).

Examples:

1. Web: pass a target URL and ask `web-index` to capture it and write a design spec, rebuild it, then compare renders.
2. Mobile: pass an APK as an absolute path and ask `mobile-index` to inspect the package and report evidence for its structure and API calls.

Each skill states its inputs and outputs. Pass absolute paths for inputs and outputs.

## Verification

From the development repository root, with the virtualenv activated:

```bash
npm run check
npm run test:e2e
python3 scripts/check_clients.py --client all
```

`--client` accepts `codex`, `claude` or `gjc`. `check_clients.py` needs the client executables, uses temporary isolated settings and makes no paid model calls. The suite contains Python regression tests and three browser e2e suites; counts change as tests are added.

Tested client versions: Codex 0.164.0, Claude Code 2.1.310, GJC 0.19.0. Older versions are not promised.

The client check covers installation, skill discovery and shared resources. Unit and browser suites additionally exercise tool behavior, image comparison and offline replay. Neither verifies parity of LLM output between clients or real-device, Ghidra or Qt functionality.

Platforms: client installation/discovery was checked on local Linux; unit and browser suites run on Ubuntu 24.04 CI. macOS and Windows were not runtime-tested. `.sh` helpers need a POSIX shell; on Windows the venv interpreter is `.venv/Scripts/python.exe`. Native tools are platform-specific.

## Sources and license

40 upstream sources were requested; 39 were cloned and reviewed. `minosdevs/copycat-skill` was inaccessible (404) and is not integrated. See `upstreams.lock.json` and `THIRD_PARTY_NOTICES.txt`.

Third-party license conditions remain in force. There is no blanket MIT claim.

## Troubleshooting

- Clone or marketplace add fails: check network connectivity or `gh auth status`.
- Skills missing after install: restart the session.
- Scripts cannot find resources: you copied individual skills; use the whole bundle.
- Missing browser or system libraries: rerun the Playwright install above against the installed bundle.
- Client behaves differently: compare against the tested versions listed above.
- GJC install odd: confirm you used the marketplace route, not `gjc plugin install .`.
- Install commands do not overwrite existing user config in tests; they run in isolated settings.

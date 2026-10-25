# Tooling

| Tool | Role | Install hint |
|---|---|---|
| JDK 17+ | runs everything | `apt install openjdk-17-jdk` / `brew install openjdk@17` |
| jadx | APK/DEX -> Java + resources (default engine) | package manager or GitHub release zip; verify `jadx --version` |
| apktool | smali + decoded resources, manifest as text | `apt install apktool` / `brew install apktool` |
| Vineflower / Fernflower | better Java for complex lambdas/generics | set `FERNFLOWER_JAR_PATH` to the jar |
| dex2jar | needed to feed Fernflower from an APK | release zip; add to PATH |
| adb | pull installed split APKs, logcat | platform-tools |
| frida / frida-tools | optional runtime confirmation | `pip install frida-tools`; server version must match |

Rules: run `scripts/check-deps.sh` once; installing anything is a user-approved step. Prefer user-space installs. Pin tool versions in `structure.md` so results are reproducible.

Pulling an installed app: `adb shell pm path <pkg>` then `adb pull` each path (base + `split_config.*.apk`). Analyze base first; ABI/density/language splits only matter for `.so` and resources.

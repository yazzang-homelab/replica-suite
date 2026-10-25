# Tooling

| Tool | Role | Notes |
|---|---|---|
| ipsw (blacktop) | `class-dump`, `macho info/sym/imp/objc`, `disass`, dyld cache extraction | `brew install blacktop/tap/ipsw` or release binary; the only Mach-O toolchain that works on Linux here |
| otool / lipo / nm / codesign / plutil | macOS Xcode CLT equivalents | `otool -L` linked libs, `-l` load commands, `-oV` ObjC, `codesign -d --entitlements :- App.app` |
| strings | literal URLs, keys, selectors | run on thin arm64 slice |
| swift demangle | Swift symbol names | ships with Swift toolchain |
| rizin / radare2 | disassembly, xrefs, ObjC classes (`rz-bin -c`) | scriptable headless |
| Ghidra headless | decompile functions, batch export | JDK 21; use native-ghidra skill for scripting |
| jtool2 | alternative Mach-O/entitlement tooling | optional |
| frida / objection | optional runtime confirmation on owned device | version-match server |

`scripts/check-deps.sh` reports availability. Ask before installing. On Linux, entitlements and load commands come from `ipsw macho info`, not codesign.

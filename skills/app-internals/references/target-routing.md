# Target routing

Choose the first inspection from what the user supplied. Prefer summary/inventory output, then targeted views.

| target | first step | then |
| --- | --- | --- |
| ASAR / extracted Electron or Node tree | JS application analysis (REA `analyze_javascript_application`, CLI `analyze-javascript-application <path> --json`; else `asar list`, read `package.json`, `main`, preload) | routes, IPC channels, modules; select exact source paths when the question is narrow |
| installation directory, runtime unknown | desktop-application probe (REA `inspect_desktop_application`; else file/dir inventory, look for `*.asar`, `*_Data/Managed`, `GameAssembly`, `python*.dll`, `.jar`, Flutter `libapp.so`) | route to the matching row |
| ZIP/APK/IPA/MSIX/AppX/DMG/installer, PyInstaller exe | archive/member inventory with hashes (REA `open_binary` + `inspect_artifact`; else `unzip -l`, `7z l`, PyInstaller extractors) | summary first, then selected members |
| Android APK code | package identity + manifest, then class search, class members, method decompile, incoming references (REA `inspect_android_package` family; JADX + JDK17 supplied by user; else `apktool d`, `jadx`) | APK is never launched; reflection/dynamic loading stays unknown |
| Apple plist/xib/asset catalog/keyed archive | resource tools (REA `open_bundle_resources`) | native code needs a separate native session |
| native exe/dll/so/dylib | identity, imports/exports, sections, strings, mitigations (REA `inspect_binary_layout`, `inspect_native_exports`, PE import/resource/TLS/Authenticode inspectors; else `readelf`, `objdump`, `rabin2`, `dumpbin`) | disassembler/decompiler (Ghidra/IDA/Hopper/Kuna provider) for named functions only |
| managed .NET PE | managed-artifact inspection (REA `inspect_managed_artifact`; else ILSpy/monodis) | metadata delta between builds |
| Go / Rust / NativeAOT / IL2CPP / Godot PCK / Flutter | language-specific metadata (build info, crate list, `global-metadata.dat`, PCK file table) before decompiling | |
| firmware image | region/entropy inspection, then extraction into a **new** output directory (Binwalk/Unblob supplied by user) | |
| CPython `.pyc`, Erlang BEAM, WASM, SQLite | header + structure inspectors; SQLite: schema first, then needed columns, from a quiescent snapshot | bytecode is not decompiled by header inspection |
| captured bundles / website scripts | source recovery (unminify/unpack) into a new dir; module import trace; route inventory | keep each input's digest and byte-range provenance |
| HAR/SAZ/PCAP/qlog | summary view first; api-surface grouping by method/origin/path template | inferences, not schemas; credential values excluded; never replay recorded URLs |
| crash report / core dump | recorded-crash inspectors (Apple `.ips`, ELF core) | historic PIDs do not select live processes |

## Runtime
Static facts do not observe execution. Pick the runtime tool by question and state its effects before use.
- **User drives, we observe (preferred):** passive browser/Electron capture of the user's already-open instance via loopback debug port: DOM/accessibility, network metadata, console shapes, script sources. Report only what was captured; never claim you clicked or evaluated unless a declared scenario did.
- **Agent drives:** a single declared scenario (actions, waits, locators, declared secrets from environment variables, never typed passwords). Only against disposable/seeded instances when it writes data. Connect mode navigates the page and can clear unsaved state.
- **Electron main process:** check packaged fuses first (`inspect_electron_fuses` or read the fuse wire); if the Node inspector CLI-args fuse is off, `--inspect` is ignored and no main target appears.
- **Native:** instrumentation (Frida), debugger (GDB/Rizin), process capture each launch/attach/mutate differently; need explicit approval, a disposable machine, and cleanup verification. Process capture is behavioural evidence, not a sandbox. A timed-out target that must write a report needs a finalization window (SIGTERM, then SIGKILL).
- **Static vs runtime:** correlate only with explicit mappings (prefer content digests); mismatches are reported, matches are hypotheses; a bundle seen at runtime does not prove every module executed.

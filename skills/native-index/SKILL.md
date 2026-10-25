---
name: native-index
description: "Router for the native- category: reverse engineering compiled binaries, Ghidra/IDA/radare2 workflows, runtime tracing, C/C++ reconstruction, retro game porting, and front-end JS reverse. Use first for: 바이너리 리버싱, 네이티브 분석, 디컴파일, 고스트라 자동화, 함수 복원, 게임 롬 분석, JS 서명 분석, reverse engineer this binary, which reverse-engineering skill should I use, ELF/PE/Mach-O triage, Ghidra MCP, trace runtime, rebuild C from binary."
---

# native-index — native reverse-engineering router

Pick the skill by intent; most investigations flow triage -> ghidra/trace -> reconstruct.

## Common contract (applies to every native- skill)
Read and apply the [common execution contract](../../references/common-contract.md). Keep decompiler dumps in the workspace. Use an isolated VM or sandbox before running unfamiliar binaries. Record ABI, load addresses and tool-generated annotations separately from observed program behavior.

## Intent -> skill
| User intent | Skill |
|---|---|
| Unknown binary/firmware/archive: file type, packers, strings, imports, plan next steps, resume an investigation, compare builds | `native-triage` |
| Drive Ghidra (MCP/RPC/headless): rename, retype, apply structs, xref-driven iterative annotation, trust model, collateral-damage checks | `native-ghidra` |
| Dynamic analysis: debugger/emulator/hook tracing, value provenance, caller/initialisation tracing, runtime boundaries | `native-trace` |
| Recreate C/C++ for functions/classes and verify against original behaviour (reverser/checker, parity grade) | `native-reconstruct` |
| Retro game ROM/EXE: disassemble, extract assets, validate with emulator, port to web canvas | `native-game-port` |
| Web client JS: how a request signature/encrypted param is built, runtime sampling, Node reproduction | `native-js-reverse` |
| Android APK / iOS IPA / app API extraction / Flutter / Unity | mobile- category router (see `mobile-android-apk`, `mobile-ios-ipa`, `mobile-api-extraction`) |
| Whole-site or whole-app clone from a URL/screens | `web-index`, `app-index`, `shot-index` |

## Typical pipelines
- **Understand a binary:** `native-triage` -> `native-ghidra` (annotate) -> `native-trace` (confirm at runtime) -> notes.
- **Recreate code:** `native-triage` -> `native-ghidra` (export evidence) -> `native-reconstruct` (loop) -> differential check via `native-trace`.
- **Retro game port:** `native-game-port` alone; call `native-trace` for emulator hooks if needed.
- **Web signature:** `native-js-reverse` (observe -> capture -> rebuild -> patch).

## Skills in this category
- `native-triage`, `native-ghidra`, `native-trace` (maintained alongside this index; read their own SKILL.md for detail).
- `native-reconstruct`, `native-game-port`, `native-js-reverse`, `native-index` (this).

## Upstream -> skill mapping (repos 34-40)
| Upstream repo | Primary skill(s) |
|---|---|
| tihanyin/REx-skill | `native-triage`, `native-ghidra` (multi-agent recon/logic/safety review ideas) |
| cellebrite-labs/ghidra-rpc | `native-ghidra` |
| GeReV/ghidra-iterative-re | `native-ghidra`, `native-reconstruct` |
| xxmisaoxx/t-rex | `native-triage`, `native-trace` |
| haikow/claude-reverse-skills | `native-triage`, `native-trace`, `native-js-reverse` (JS playbook) |
| Dryxio/reagent | `native-reconstruct` |
| vgrichina/re-skill | `native-game-port` |

## Shared conventions
- Workspace per target: `SCOPE.md` (target, hash, objective), notes/evidence files, `dead_ends.md` for failed approaches.
- Prefer evidence over inference: label each claim with its source (decompiler, trace, doc). Verify before declaring done and state verification limits.
- Ask before installing tools or running untrusted binaries.

## Sources
Router synthesized from: tihanyin/REx-skill, cellebrite-labs/ghidra-rpc, GeReV/ghidra-iterative-re, xxmisaoxx/t-rex, haikow/claude-reverse-skills, Dryxio/reagent, vgrichina/re-skill.

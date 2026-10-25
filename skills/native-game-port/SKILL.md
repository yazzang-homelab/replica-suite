---
name: native-game-port
description: "Analyze an existing (retro) game binary or ROM you own, extract its assets and rules, and drive a documented, verified port or reimplementation to the web (HTML canvas). Use for: game reverse engineering, ROM/EXE disassembly with labels, sprite/tile/palette extraction, data table decoding, scriptable emulator for validation, web port of a DOS/NES/Game Boy/Amiga game, REVERSE.md project loop. Korean triggers: 게임 리버스, 롬 분석, 에셋 추출, 스프라이트 타일 팔레트 추출, 웹 포팅, 게임 재구현, 레트로 게임 복원, 에뮬레이터 대조 검증."
---

# native-game-port

Run a long, resumable reverse-engineering project on a game binary, ending in a faithful web reimplementation validated against the original running in an emulator. Knowledge accumulates in files, not in chat.

## When to use
- A ROM/EXE (NES, Game Boy, DOS MZ, Amiga hunk, similar flat or banked images) that the user owns, and the goal is understanding, asset extraction, or a port.
- For modern engine games (Unity/IL2CPP, Unreal) use the mobile/native engine skills via `native-index`; for general binary triage use `native-triage`.

## Authorization / clean-room gate (do first)
1. Write in `REVERSE.md` header: who owns the copy, the permission basis (own legally obtained copy, abandonware status is NOT permission; or rights-holder consent).
2. Keep original ROMs/binaries and extracted raw assets in the private workspace, git-ignored. Do not publish them.
3. The shipped port is a clean-room reimplementation: behaviour, rules, timings and formulas as documented facts. Ship with new/user-provided art, audio and names unless the user confirms they hold rights to the originals; strip trademarks.
4. Stop if ownership/permission cannot be stated.

## Workflow (phases; each ends with a verification checkpoint)
Phase detail and tool specs: [references/phases.md](references/phases.md).

1. **Bootstrap.** Create `REVERSE.md` (identification table, memory map, data-range map, Next Tasks with `[ ]`/`[x]`), `labels.csv`, `dead_ends.md`, `tools/`, optional loop driver script. Also `CLAUDE.md` with platform conventions and binary path.
2. **Identify.** Magic bytes/header, platform, CPU, memory map, entry vectors, compiler artifacts. Gate: identification table filled and consistent with file size.
3. **Unpack if needed.** Trace the decompressor from the entry point; write `tools/decompress.py`; all later work uses the unpacked image. Gate: unpacked output has plausible structure (code/tables, not high entropy).
4. **Disassemble.** Build, in order: instruction-set database, targeted disassembler that auto-loads `labels.csv`, byte-pattern search, xref finder. Gate: 3+ functions traced and cross-checked against an emulator trace.
5. **Extract assets.** Decode tiles, sprites, palettes, tilemaps, fonts, text; render PNGs and an interactive `web/catalog.html`. Gate: 5+ assets visually compared with emulator screenshots.
6. **Map data structures.** Decode tables, pointer arrays, structs with stride and field layout. Gate: key struct fields match an emulator memory dump.
7. **Scriptable emulator (only if static analysis cannot settle physics/AI/timing).** Minimal CPU+memory+loader with address hooks, state save/restore, key injection, breakpoints, trace, screen dump. Build incrementally with a test at each layer.
8. **Validate.** Play sessions in a reference emulator; diff runtime state against `REVERSE.md`; mark sections `(VERIFIED)`. Gate: full session played with no major logic gap.
9. **Web port.** Plain HTML/JS canvas, pixelated scaling, fixed-timestep loop matching the original frame rate; every constant traced to `REVERSE.md`. Gate: screens compared with emulator frames, differences logged in `COMPARISON.md` (FIXED / MINOR / CRITICAL).
10. **Document.** `docs/architecture_exe.md` (layout, call graph, module map, per-turn flow) and `docs/architecture_web.md` (module graph, EXE-to-web mapping, loop, state machine). Project is not complete until both exist.

## Session discipline
- Write findings to `REVERSE.md` after every 2-3 tool calls, not at the end. Add every address to `labels.csv`.
- Stuck rule: 10 tool calls without progress -> log in `dead_ends.md` (tried / why failed / better approach), split the task into 2-3 sub-tasks. Three sessions on one task -> the decomposition is wrong; rethink.
- Read `dead_ends.md` and the last sessions' logs before starting. End each session with `SESSION_SUMMARY: <one line>`.
- Write tools as files under `tools/` and run them; avoid inline one-liners so work is reproducible.

## Pitfalls
See [references/gotchas.md](references/gotchas.md): relocations breaking byte search, two-level pointer tables, tile index vs VRAM address, runtime-composed text, bank-aware xrefs, struct stride errors.

## Output artifact layout
```
REVERSE.md  labels.csv  dead_ends.md  COMPARISON.md  CLAUDE.md
tools/ (dis, xref, search_bytes, decode_tables, extract_tiles, render_screen, emu/)
gfx/  data/  docs/  web/ (index.html, catalog.html, modules)
re_loop_sessions/   per-session logs
```

## Sources
- vgrichina/re-skill (MIT): phased loop, REVERSE.md/labels.csv/dead_ends conventions, gotchas.
- Dryxio/reagent and GeReV/ghidra-iterative-re: verification mindset (see `native-reconstruct`, `native-ghidra`).

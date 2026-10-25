# Phase and tool detail

## labels.csv formats
- Flat: `offset,name,comment` (offset `0x25DE9`).
- Banked ROM: `bank,addr,name,comment` (addr hex, no prefix).
- Segment-relative: `DS:0xCEAC,name,comment`.
Every tool loads it so names appear inline in disassembly.

## Tool CLI contract (adapt per platform)
- `dis <addr> [lines]` / `dis <bank> <addr> [n]` / `dis <file> <addr> --hunk N`
- `xref <addr> [bank] [--code] [-r START END] [-c N]` (relocation/bank aware)
- `search_bytes <hex> [--context N] [--disasm]`
- `decode_tables <addr> <count> <fmt>` with fmts u8/s8/u16/s16/u32/ptr16/farptr/q8/b8/nullstr, `struct:<n>:<fields>`, `--follow` for two-level pointers.
Adding a platform = writing its instruction-set module; everything else reuses it.

## Asset catalog sections (use what applies)
Sprites/tiles at 4x pixelated, direction cyclers, animation playback at original timing, cutscene frame players, palette swatches with indices, font samples, scrollable level maps, stat-card tables (items/enemies), audio buttons, searchable dialogue dump. Plain HTML+JS, served with a static file server; data comes from findings, purpose is validation.

## Emulator layers
loader -> memory (8/16/32-bit and float helpers) -> cpu (registers, flags, FPU) -> execute -> interrupt/OS stubs -> port stubs (video/audio) -> state serialisation -> CLI (`--break`, `--trace`, `--keys STEP:CODE`, `--dump-screen`, `--run-func LABEL`, `--compare` CSV for diffing against the port).

## Verification checkpoints (tick in REVERSE.md)
Ph3 3+ functions vs trace; Ph4 5+ assets vs emulator; Ph5 struct vs memory dump; Ph6 full session; Ph7 web port pixel-compared. Pixel comparison: capture same state in both, diff, classify by severity.

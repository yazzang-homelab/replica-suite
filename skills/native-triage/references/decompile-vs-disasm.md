# Decompiler vs disassembly

The decompiler guesses types, prototypes and calling conventions, then prints the guess as C. Use it for shape, use bytes for facts.

## Read disassembly when
- **Signedness decides the answer.** Signed vs unsigned compare is often the whole bug.

| Arch | signed | unsigned |
|---|---|---|
| x86 | `jl jg jle jge` | `jb ja jbe jae` |
| AArch64 | `b.lt b.gt b.le b.ge` | `b.lo b.hi b.ls b.hs` |
| MIPS | `slt slti` | `sltu sltiu` |
| RISC-V | `blt bge` | `bltu bgeu` |
| PowerPC | `cmpw cmpwi` | `cmplw cmplwi` (the `l` is unsigned; following `blt/bge` reads the same) |

- **Narrowing loads**: sign-extending vs zero-extending 16-bit length loads are different programs; C shows neither.
- **Variadic calls**: stack-passed varargs may be dropped with their computation (notably AArch64 Apple ABI). A decompilation that is two `printf`s and a few stores can hide a hash, a modulo and a guard before a divide.
- **Delay slots** (MIPS/SPARC): instruction after the branch executes regardless.
- **Convention doubts**: wrong `__stdcall`/`__thiscall`/`__fastcall` makes every argument wrong while the C stays plausible. Check stack cleanup (`ret 0xc`) against declared parameter bytes.
- **Inlining/fusing**: three functions fused make guard and sink look unrelated.
- **Rolled SIMD** copies look like loops with wrong bounds; `undefined` stack slots and spurious aliasing of locals are recovery artefacts.
- **Short decompilation**: check for dropped-argument markers and read the asm before concluding a function is trivial.

## Use the decompiler for
Control-flow overview, naming, struct field access after typing, quick caller/callee sweep, comparing versions at source level.

## Reconciliation rule
When tools conflict, the bytes win; record both sides, then pick a discriminating check (xref, emulation, runtime probe in `native-trace`).

## Fixing the analysis (see `native-ghidra`)
Missing functions (code decoded as data, ARM/Thumb mode wrong, function reached only via GOT), missing no-return flags, wrong calling convention, missing varargs prototype. Fix the model, re-run cascade, re-read.

## Alignment/mode traps
Thumb `TMode=1`, MIPS16 `ISA_MODE=1`: set before disassembly or you decode convincing nonsense. A byte-shifted region poisons everything after it: clear and re-disassemble from a known boundary. Analysing at a wrong image base produces a full, plausible, wrong program.

---
name: native-reconstruct
description: "Rebuild readable, compilable C/C++ from a compiled binary (ELF/PE/Mach-O/firmware) function by function, then verify the rebuild against the original's behaviour with independent checking, structural diffing, build/test gates and a parity grade. Use for: decompile to source, recreate function in C, matching decompilation, reconstruct class from Ghidra output, reimplement binary module, reverser/checker loop, parity check. Korean triggers: 바이너리 C/C++ 재구성, 디컴파일 결과를 소스로 복원, 함수 재작성, 원본 동작과 동일한지 검증, 클래스 복원, 패리티 검증."
---

# native-reconstruct

Turn decompiler evidence into clean C/C++ that behaves like the original, and prove (as far as feasible) that it does. A passing result is **conservative evidence, not a proof of equivalence**; say so in every report.

## When to use
- You hold a binary plus a disassembler/decompiler project (Ghidra, IDA, radare2 exports) and want source for specific functions/classes.
- You maintain a partial source tree (e.g. a decompilation or compatibility project) and need to fill unimplemented functions.
- Not for: first-pass triage (`native-triage`), driving Ghidra itself (`native-ghidra`), runtime tracing (`native-trace`), or re-creating a game (`native-game-port`).

## Scope and clean-room gate (do first)
1. Record in `rebuild/SCOPE.md`: binary identity (path, sha256, version) and target scope.
2. Output is a behavioural reimplementation. Keep original decompiler dumps in the workspace, not in published code, and rename vendor branding when rebranding.

## Workflow
Details for each stage: [references/pipeline.md](references/pipeline.md).

1. **Plan the target set.** Export function list with caller counts and call edges. Order by `dependency-order` (callees first; recommended), `easiest-first` (few callers) or `high-impact` (many callers). Write `rebuild/manifest.tsv` (addr, name, class, status, attempts). Cap attempts per function (default 3) and total model/tool budget.
   - Gate: manifest has no duplicate addresses; every entry resolves in the Ghidra project.
2. **Gather evidence per function** (read-only): decompile, assembly, normalized P-code/CFG, xrefs to/from, struct/enum/vtable layouts, globals, referenced strings, neighbouring already-rebuilt source. Save as `rebuild/evidence/<addr>.json`. Missing evidence stays an explicit gap; never silently guess.
   - Gate: every callee and global the function touches is named or marked `UNRESOLVED`.
3. **Reverse (author pass).** Write C/C++ that preserves branches, calls, integer widths, signedness, offsets, side effects and calling convention. Floating-point expression order is significant (`a*x+b*y` != `b*y+a*x`). Name only what evidence supports. Finish with a trailer line `REVERSED_FUNCTION: Class::Name (0xADDR)`.
4. **Check (independent reviewer pass).** Use a separate agent/model context with no access to the author's reasoning. Verdict `PASS|FAIL` plus concrete issues: every decompiled statement has a counterpart; every struct offset maps to a named member; every call matched; no missing branch/edge case. On FAIL feed fix instructions back to step 3; bound the rounds (default 3) and allow evidence requests between rounds.
5. **Structural verify (objective, non-LLM).** Compare mechanical signals between source and binary: call count/order, branch count, constant sets, string refs, float-op presence, stub markers (`TODO`, empty body), asm size vs source size, inline-wrapper shape. Any strong mismatch blocks acceptance regardless of the reviewer.
6. **Candidate build/test gate.** Overlay the candidate in a disposable copy of the project (never edit the real tree until accepted), then run configured build, unit tests and runtime checks. Use argument arrays, not shell strings, so commands are portable. Cumulative class runs validate against all previously accepted functions.
7. **Differential check where possible.** Run original function (emulated or in-process under a harness, see `native-trace`) and the compiled candidate on the same inputs including edge values (0, -1, INT_MIN, NaN, null, max length); diff outputs and memory writes. ABI adapters are per-project; never assume one.
8. **Parity grade.** GREEN = all gates pass; YELLOW = passes but a warning signal (e.g. FP sensitivity, low call count) needs a human note; RED = block. Acceptance requires: reviewer PASS, no strong structural mismatch, candidate gates pass, parity not RED (and not YELLOW unless a manual approval entry exists).
9. **Promote** accepted code to the real tree, update manifest status, append to the knowledge notes (call graph, strings, globals). Keep failures and their reasons in `rebuild/dead_ends.md`.

## Output artifact layout
```
rebuild/
  SCOPE.md            binary identity + target scope
  manifest.tsv        plan and per-function status
  evidence/<addr>.json
  candidates/<addr>/  source, round logs, reviewer verdicts
  reports/<addr>.md   verdict, signals, gate results, grade
  coverage.md         accepted / stale / failed / gaps
  dead_ends.md
```

## Rules
- Never mark done on reviewer PASS alone; all four acceptance conditions apply.
- Re-verify stale results when a callee or struct definition changes.
- Report budget used and what still needs human review. See [references/parity-signals.md](references/parity-signals.md).

## Sources
- Dryxio/reagent (MIT): reverser/checker loop, evidence tools, candidate overlay, parity gate, manifests.
- GeReV/ghidra-iterative-re and tihanyin/REx-skill: iterative evidence-driven refinement ideas (see `native-ghidra`).

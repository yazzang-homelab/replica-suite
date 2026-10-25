---
name: native-ghidra
description: Drive Ghidra for native reverse engineering headlessly (analyzeHeadless, PyGhidra, a ghidra-rpc style daemon, or Ghidra MCP servers) with an iterative checkpoint-apply-cascade-verify loop and the SourceType trust model so the agent never corroborates its own guesses; includes pointers for IDAPython/IDALib and radare2/rabin2 when Ghidra is not the tool. Use for "Ghidra", "analyzeHeadless", "PyGhidra", "rename functions/retype structs in Ghidra", "decompile and annotate", "Ghidra MCP", "IDAPython", "idalib", "radare2 r2 script", "patch diff two binaries", "고드라/기드라 분석", "헤드리스 디컴파일", "함수 이름 적용", "구조체 복구", "IDA 스크립트", "radare2 사용".
---

# Native Ghidra control

Ghidra is an inference engine with a persistent database: what you apply changes what the decompiler shows next. Use that, but never let your own applications become evidence for the claims that motivated them.

## Gate
1. Static analysis only. Ghidra never executes the target; anything that would (debugger, emulation, network) needs `native-trace` sandbox rules.
2. Project lives **outside** the sample directory and outside any dot-directory (Ghidra project paths with dot-dirs break). Original sample stays read-only; import a copy.
3. Record Ghidra version, JDK, program SHA-256, language/compiler spec, image base in `ghidra/manifest.json`. Wrong language/endianness/base at import poisons everything: verify before analysing; import with no-analysis first on large or odd targets, fix memory map/language, then analyse once.

## Pick the control surface
| Surface | Use when | Notes |
|---|---|---|
| `analyzeHeadless` + `-postScript` | batch export, CI, repeatable | `-import -overwrite -scriptPath -postScript`; set timeouts |
| PyGhidra (library mode) | scripted loops, reads and mutations | preferred for mutation; transactions explicit |
| RPC daemon (ghidra-rpc style, JSON CLI over a socket) | many small queries across a session, no JVM restart | `references/control-surfaces.md` |
| Ghidra MCP server | interactive query | read-only use; see trust rule below |
| GUI | human adjudication | keys in reference |
Start with `scripts/ghidra_export_summary.py` (functions, imports, exports, strings, xrefs, call graph, CFG summaries) to get bounded JSON evidence once, then query selected functions instead of re-analysing.

## The loop
```
checkpoint -> apply (one certainty tier, tagged SourceType.AI) -> cascade (scoped)
           -> verify invariants -> harvest (exclude AI) -> adjudicate -> next round
```
Stop after two consecutive rounds yield nothing new, not when ideas run out. Details: `references/apply-cascade-verify.md`.

### Round zero (new binary): measure, do not apply
Run the free-names sweep from `native-triage` inside Ghidra (exports, mangled names, RTTI, debug records, init tables, source-path strings). Record every result including zeros. Only then enter the loop, starting from the highest-certainty source found.

### Resuming a project
Read the project state record first (program version, last mutating round, gate numbers). Notes were true when written: re-measure with one read-only census before scoping a queued round.

### Per round
1. **Checkpoint**: end transaction, save, snapshot/copy project, then proceed (order matters; snapshot before save captures the old state). Prove a restore works once before relying on it.
2. **Apply** only this round's tier. Mutating scripts take an explicit `apply` flag; bare run is a dry run. Signatures/`this` types first, then locals (each retype re-runs the decompiler and renumbers `uVarN`; batch edits against one snapshot or address by storage).
3. **Cascade**: tell `AutoAnalysisManager` what changed (addresses/sets, not `Function` objects) then `analyzeChanges`; avoid `analyzeAll` on a curated program. Never measure payoff before cascade ran; the cascade is the stage agents skip because it leaves no artifact, so end every mutating script by running it or printing why none applies.
4. **Verify invariants**: diff a whole-program invariant (function count, defined-data count; count the same way each time) before/after and `raise` on change. A clean return is not proof nothing was damaged (broad `ApplyFunctionDataTypesCmd` has silently deleted functions). Re-assert what you applied survived the cascade (the demangler/analyzers may overwrite equal-priority AI markup).
5. **Harvest** evidence read back from the program excluding `SourceType.AI`; write versioned evidence files.
6. **Adjudicate**: promote to decided facts only with >=2 structurally independent witnesses; record exclusions and unresolved conflicts with reasons.

## SourceType trust model (load-bearing)
Priority `USER_DEFINED > IMPORTED > ANALYSIS = AI > DEFAULT`. Ghidra does not enforce "AI is not evidence"; your harvesters must.
- `IMPORTED` (from the file itself: export labels, debug records) = ground truth. `ANALYSIS` (including demangler output) = evidence only with the producing mechanism named. `DEFAULT` (`FUN_`/`DAT_`) = absence of information.
- **Tag every mutation you make `SourceType.AI`** and make every harvester exclude it; test the filter by tagging one known symbol and confirming it disappears from the harvest. The filter is needed before a harvester's second run.
- A donor type/name that is itself inferred does not become evidence by agreeing across siblings; admit only binary-declared donors, treat inferred donors as leads checked at call sites.
- Types have no SourceType; track type provenance in your own ledger.
- **MCP/RPC mutation tools typically hardcode `USER_DEFINED`**, laundering inference into the top tier. Use read-only queries through them; do mutation through scripts you control that write `AI`, unless you have verified which tier the tool writes. Audit any server before trusting it.

## What to apply (highest payoff first)
Create missed functions at undefined code (set Thumb `TMode`/MIPS16 context first); mark non-returning functions (else the listing after calls is corrupted; check error bookmarks); correct calling conventions and varargs prototypes; typed signatures for imports and recovered names; struct layouts then retype pointers; vtable slots as typed function pointers; comments carrying evidence addresses. See `references/apply-cascade-verify.md`.

## Other tools
IDA via MCP/idalib/IDAPython and radare2/rabin2 equivalents, with the same trust rules: `references/ida-r2-pointers.md`.

## Output artifact layout
```
ghidra/
  manifest.json            # versions, hashes, language, base
  project/                 # .gpr + .rep (outside sample dir)
  export/summary.json      # ghidra_export_summary.py output
  rounds/NN/{plan.md, apply.py, dry-run.log, invariants.json, harvest.csv, adjudication.md}
  decided.csv              # name/type/field, confidence, witnesses, source tier
  snapshots/               # append-only checkpoints
```

## References
- `references/control-surfaces.md` - analyzeHeadless, PyGhidra, RPC command set, MCP caveats
- `references/apply-cascade-verify.md` - ceremony by blast radius, invariants, rollback, traps
- `references/ida-r2-pointers.md` - IDAPython/IDALib/radare2 quick map
- `scripts/ghidra_export_summary.py` - bounded JSON export (MIT, RevEng)

## Sources
GeReV/ghidra-iterative-re (loop, SourceType model, mutation safety), cellebrite-labs/ghidra-rpc (daemon/command surface, batch-edit ordering; ideas only, unlicensed), tihanyin/REx-skill (Ghidra fixes, decompile helpers), th3vib3coder/RevEng ghidra-headless (export script, no-execute policy), xxmisaoxx/t-rex (cached project reuse, coverage/partial status), haikow/claude-reverse-skills and P4nda0s/reverse-skills (IDA/radare2/IDAPython pointers, reimplemented).

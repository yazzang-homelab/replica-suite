# Reconstruction pipeline detail

## Evidence record (per function)
Fields: address, name, class, decompile text, disassembly, high P-code and CFG (normalized), xrefs_from, xrefs_to, structs touched, enums, vtables, globals, strings, nearby project source, `gaps[]`. A gap is a named piece of missing evidence (e.g. "vtable at 0x... not exported"). Reports list gaps; they never disappear silently.

## Evidence requests inside the loop
The author may ask for more read-only evidence instead of guessing: decompile(addr), xrefs_from, xrefs_to, struct, enum, vtable, global, strings, context, pcode, cfg. Allow only requests that resolve a concrete uncertainty; log each one; bound total per round.

## Ordering strategies
- dependency-order: depth-first over callees within the candidate set, cycles broken by visited set. Best default: callees are accepted before callers are checked.
- easiest-first: ascending caller count; good for quick wins and calibrating settings.
- high-impact: descending caller count; use when a few hub functions block progress.

## Budgets and checkpoints
Each round writes a checkpoint (candidate, verdict, gate output). One audit record per model call. Hard limits: model calls, rounds per function, attempts per function. Resume from the last checkpoint instead of restarting.

## Validation commands
Store as arrays: `["cmake","--build","build"]`. Run in the disposable overlay. Capture exit code, stdout tail, duration. Distinguish build failure, test failure, runtime failure, timeout in the report.

## Differential harness shape
`harness(inputs) -> {ret, out_params, memory_diff}` for both original (emulated/hooked) and candidate. Inputs: fixed seeds, boundary values, captured real-world values from a trace. Mismatch report: first differing field, input, both outputs.

## Cleanliness
Drop decompiler artifacts (`undefined4`, `local_XX`) in favour of evidence-backed names; keep a comment only for non-obvious behaviour. Keep original offsets in a trailing comment where members are partly unknown.

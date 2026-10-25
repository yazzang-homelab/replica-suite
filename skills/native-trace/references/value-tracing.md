# Value, caller and initialization tracing

## Address domains
Never mix: file offset, RVA (image-relative), preferred VA, rebased runtime VA, section-relative offset. Write each conversion (`va = base + rva`, section delta) into `maps/<rev>.json` bound to one artifact revision. Ghidra addresses are absolute in the default space, not RVAs.

## Function identity
Boundaries come from unwind tables, symbols, exports, analyzer, CFG reconstruction or heuristics; record the authority and confidence. A linear sweep can decode data as code.

## Value provenance at a sink
1. Pin the exact instruction and operand.
2. Find the local reaching definition; cross blocks via CFG/dominance. A dominating definition is not automatically the unique reaching one: later writes, merges, aliasing, calls and exception edges matter.
3. Account for call clobbers (callee-saved vs caller-saved), stack-pointer deltas, frame pointer use, reused slots, incoming stack args.
4. Distinguish address calculation from dereference, a pointer's storage from its pointee, and zero-initialized storage from a later runtime value.
5. Go to callers only when the definition is a parameter; pass one question up per hop.

## Global/object provenance
Identify storage; enumerate reads and writes; find constructors, initializers, registrations; separate file-backed (`.data`) from runtime-initialized; consider indirect stores, loader and thread init (TLS, `.init_array`, `DllMain`). Byte-search for the address before recording a zero reference count (references exist only where code was disassembled).

## Indirect dispatch
Candidates: function pointers, vtables (construction + registration), import thunks/PLT/GOT, callback registries, jump tables (control dispatch, not callables), selectors/interfaces, dynamically resolved APIs, tail transfers. Say whether indirect coverage was attempted before claiming a complete caller list. Runtime confirmation (breakpoint at the call, log the target) resolves what static cannot; normalize to module+RVA.

## Branch reasoning
Recover condition and flag provenance; separate syntactic from feasible paths; include exception edges; ask runtime or emulation when feasibility is open.

## Bounds and arithmetic
Use half-open ranges; check file bounds, architecture/endianness, decode mode (ARM/Thumb). Bit-level bounds claims: solve (SMT/symbolic) or emulate rather than eyeball.

## Negative claims
Prefer "no direct xref within <scope> using <method>, indirect search <done/not done>" over "never". Partial, truncated or failed coverage cannot establish absence. Record the bound in `--bound`.

## Provider disagreement
Parser output, CFG databases and pseudocode are fallible interpretations. Keep both reports and pick a discriminating check (raw bytes, metadata, a different provider, a runtime read). No provider quorum is required; authority is claim-specific: file bytes establish stored representation, runtime memory establishes loaded or generated representation.

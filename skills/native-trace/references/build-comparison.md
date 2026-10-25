# Build comparison

## Bind first
Hash, size, format/arch, profile, package/section inventory for both builds. Offsets from different artifacts never share identity. Record parent revision and reason (rebuild, vendor update, controlled patch).

## Compare in layers (stop at the layer that answers)
1. container/package inventory
2. sections/segments
3. imports/exports/dependencies
4. strings/names/metadata
5. function identity (symbols, signatures, constants, hashes of normalized bytes)
6. calls and references (neighbourhoods)
7. normalized CFG/instruction structure (mask relocations, absolute addresses, register renaming where tools allow)
8. pseudocode/source-level text
9. runtime behaviour under the same input

Tools: Ghidra Version Tracking/BSim, radiff2, diaphora-style matchers, `bindiff`; symbol porting from a build with names onto a stripped one needs confirmed matches (exact-match or multiple correlators) and the donor hash recorded.

## Claims
- Byte or pseudocode differences do not by themselves mean behaviour changed. Name the changed control/data dependency, constant, condition, call, side effect or observed behaviour.
- Patch attribution needs exact pre/post bytes and a list of uncontrolled differences; avoid causal claims when others remain.
- Controlled patches: record exact spans, patch on a copy, re-hash, re-verify decoding/CFG/xrefs and runtime mapping.

## Revalidation after a new build
Old claims become historical; dependents stale. Reuse an unchanged claim only after re-reading its location in the new artifact. Maintain `DIFF.md`: changed, unchanged-verified, needs-revalidation, with ledger IDs.

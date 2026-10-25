# Apply, cascade, verify

## Ceremony by blast radius
| Claim class | Minimum evidence | Cost of being wrong |
|---|---|---|
| reconnaissance ("this region looks like a table") | one read | none |
| count in a report | derived by query, never a literal | stale denominator |
| decided artifact row (name/size/field) | >=2 independent witnesses; conflicts left unresolved | every later round trusts it |
| program mutation | checkpoint + change-set diff + post-cascade re-assert | silent collateral damage |
| rule change in a harvester | old-vs-new rule diff | regeneration reintroduces defect |
Spend the heavy apparatus only on the bottom three rows.

## Mutation bracket
- Invariant before/after every mutating operation, raising on change (function count; use one counting method consistently: externals included or not; address-ordered iteration is not a filter).
- Use the program-diff facility for a real change set when risk is high.
- A mutation script gates on `apply`; dry-run must not write artifacts that later act as evidence.
- A no-op set (value already what you would write) should be a distinct, counted state so reruns converge.
- Never destroy an existing human annotation; append beneath it.
- Naming applies can create types you did not ask for; typing a receiver can break calls through it: predict the delta by name before running.
- Width-preserving type applies can still change decidability downstream: rehearse.

## Checkpoint and rollback
1. End transaction -> save -> snapshot -> then mutate. Snapshots append-only (a second round must not overwrite the first round's recovery).
2. Rehearse a restore once. Establish which side is ahead (program vs ledger) before reverting a raised apply.
3. Keep forward recovery as well as rollback.

## Cascade
- Trigger: `analyzeChanges` after telling the analysis manager what changed (addresses). `analyzeAll` can undo curation.
- Decompiler Parameter ID run too early propagates bad information; fix memory map, entry points and no-return first.
- The cascade can overwrite equal-priority AI markup (demangler applies when existing is not higher than ANALYSIS) and some analyzers write USER_DEFINED themselves (variadic signature override): re-read what you applied.

## Harvesting without circularity
- Exclude `SourceType.AI` rows from evidence; run the exclusion test.
- A calibration population that your repair consumes is a countdown, not a calibration: calibrate on rows nothing in the loop can reach (export tables, debug records).
- Scoping a witness out is not discarding it: relabel and keep counted.
- A census licenses a repair: when a round discovers a defect, write the read-only census first, repair next round.
- Counts quoted in reports must be derived, not typed.

## Evidence that an external source exists
Binary-declared (export names, mangled symbols, RTTI, debug path) > analyzer output > agent inference. Reconcile against an external oracle where one exists (a recompile-and-diff, a documented ABI, known library source); target vs host pointer width breaks headers first.

## Failure modes to design against
- cascade skipped silently; payoff measured before cascade
- harvester turns circular on its second run
- MCP mutation laundering to USER_DEFINED
- fix applied to wrong donor tier (siblings agreeing on an inferred type)
- prototype patched in one position when the body's stack cleanup shows the whole shape is off
- stale notes treated as measurements

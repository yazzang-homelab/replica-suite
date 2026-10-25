# Resumable notes

## Principles
One canonical file owns claims; generated views are disposable. Do not keep two editable copies of a claim. Target facts live in the project workspace, never in a global skill.

## Ledger (scripts/trace_ledger.py)
Records: `init` (objective, artifact hashes), `claim` (id Ex, kind observed/derived/inferred/rejected/probe, text, loc, deps, tool, coverage, bound, artifact rev), `next` (question, exact probe), `advance` (new build binding), `drift`.
Semantics:
- observed = direct read; derived = deterministic from cited deps; inferred = interpretation with alternatives. Unanswered questions are UNKNOWN and live in `next`/hypotheses, not claims.
- Class, confidence and validity are independent; do not auto-promote or decay by age.
- Supersede with a new ID instead of rewriting; stale propagates through dependency closure.
- Commands: `init`, `add`, `next`, `check` (re-hash artifacts), `advance OLD=NEW`, `show`.

## Checkpoints
Checkpoint at: finding or strategy change, before mutation (patching, project edit), interruption, context pressure. Write payloads to `evidence/` first, then reference them from the ledger. Do not rewrite unchanged state each probe; run integrity checks at recovery and checkpoint boundaries only.

## Probe records
Signature = artifact rev + question + capability + normalized params. Record outcome, novelty, retry condition. Repeat an unchanged probe only if input, version, coverage, decoder or hypothesis changed. Two comparable no-novelty probes => reassess saturation, change discriminator or question.

## Resume protocol
1. read the generated view as a pointer; 2. verify artifact identity (`check`); 3. verify chosen profile/tool versions; 4. pick the highest-value unresolved question; 5. continue from its exact NEXT. Re-pasted prompts, compaction, and model or host switches do not restart reconnaissance; invalidate context-size measurements and keep IDs.

## Long runs
Each operation should answer a question, eliminate a hypothesis, reduce ambiguity, make evidence durable or unlock a better probe. Prefer expected information gain per cost: a decisive write-xref, unique caller slice, freshness check, or discriminating runtime read over repeated dumps. If a tool fails, preserve state and switch representation; do not spend the session repairing tooling unless that is the task. Stronger drift checks after patching, rebuilding, branch switches, backup restores, long interruptions or conflicting output.

## Report
Answer first (2-3 sentences), then findings each linked to claim IDs and addresses, then coverage and limitations, open questions, exact next step.

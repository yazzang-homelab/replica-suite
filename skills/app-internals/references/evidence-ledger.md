# Evidence ledger and closure discipline

## Record format (`appclone/internals/ledger.md`)
```
E-014  claim: main process registers IPC channel "export:run"
       source: app.asar:/dist/main.js  sha256 <artifact>  bytes 41200-41388
       method: tool/command + args (exact)   output ref: internals/out/E-014.txt (sha256)
       authority: observed-static | observed-runtime | inferred | unknown
       limits: partial inventory? obfuscated? reflection unresolved? truncated?
       contradicts/supports: E-009, E-021
```
- Authority is never upgraded: a static graph edge does not prove runtime behaviour; a format match is an inference, not handler identity.
- Absence is only claimable when the source was complete and the question scoped to it ("not in the selected inventory" vs "never happens").
- Keep contradictions: record and continue; they block only the equivalence claims they affect.

## Unknowns
`U-003 question | evidence for/against | authority or environment still required`. Close an unknown only with qualifying *observed* evidence; stale revisions are re-read, not retried blindly.

## Comparing
Compare only complete, compatible page sets; truncation, instability, unavailable authority or a contradiction means **unknown**, not equal. Concurrent behaviour needs partial-order comparison, not total order. Locate the first/primary divergence rather than reporting a blanket difference. Static diffs between builds are candidates for changed behaviour.

## Reconstruction closure (when the goal is a reimplementation)
Turn each behaviour claim into an obligation: id, revision, owner (module/function in the new code), required parser/schema/type, required fixtures (original-derived cases), and a verifier that enumerates the obligation id. An obligation closes only when owner + fixtures + passing verifier whose authority is comparable to the original observation are all bound to the exact implementation digest and revision. Duplicate owners, residual unknowns, missing dependencies or unavailable authority keep it open. Report `open / failed / ready` counts; "ready" means zero required obligations open, not global equivalence. Process-behaviour claims require observed controlled replay, not matching names.

## Reproducibility
Hash every artifact and output; note tool versions; export the ledger and outputs so another person can replay and detect stale inputs. Close opened sessions and processes; report cleanup state.

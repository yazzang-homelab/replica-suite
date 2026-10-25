# Run ledger (`.web-clone/run.json`)

Create after the foundation step; update after every phase, merge, repair attempt, and failure. Keep prior attempts; never overwrite history. The ledger is an audit trail, not a substitute for tool output.

```json
{
  "url": "https://example.com/",
  "intent": "clean-room-reimplement",
  "phase": "author",
  "status": "running",
  "started_at": "ISO-8601", "updated_at": "ISO-8601",
  "breakpoints": [1440, 768, 390],
  "planned_sections": ["header", "hero", "features", "footer"],
  "completed_sections": ["header"],
  "gate_results": {
    "capture_integrity": {"status": "pass", "evidence": []},
    "critical_structure": {"status": "pending", "evidence": []},
    "interactions": {"status": "pending", "evidence": []},
    "build": {"status": "pending", "evidence": []},
    "fingerprints_hotlinks": {"status": "pending", "evidence": []},
    "visual": {"status": "pending", "evidence": []}
  },
  "attempts": [], "residuals": []
}
```

- `phase`: capture | extract | foundation | dispatch | merge | assemble | build | verify | repair | handoff
- `status`: running | ready_for_user_review | failed_with_residuals
- gate status: pending | pass | fail | waived (waive only on explicit user acceptance or a measured technical ceiling; record reason + evidence in residuals)

## Gate order
capture integrity -> planned structure + critical anchors -> interaction replay -> production build -> fingerprints/hotlinks/weight -> visual per breakpoint x state -> baseline comparison. An earlier red gate blocks handoff regardless of later scores.

## Attempt record
`{"number":1,"gate":"critical_structure","target":"hero","before":{...},"change":"restored omitted hero region","after":{...},"evidence":["path"]}` - log non-improving attempts too; keep the best artifact.

## Residual record
`{"gate":"visual","target":"hero@390","expected":0.97,"measured":0.91,"attempts":5,"evidence":["path"],"reason":"repair budget exhausted"}` - never replace with "mostly matches".

## Resume rule
If `run.json` exists: compare normalised URL; same URL + `running` => resume the first incomplete phase after re-checking the last artifact; different URL => fresh run; never turn a prior failure into success without new gate output.

# Evidence and honesty rules

## Clone-mode labels (a delivery must carry exactly one)
| Label | Meaning | Allowed claim |
|---|---|---|
| exact reuse | original page/embed/preview reused as-is (iframe/embed) | "same source" |
| source reuse | export/remix/source files used | "built from provided source" |
| runtime mirror | captured frontend code replayed locally (often via iframe boundary) | "replays captured frontend; not editable source; backend not local" |
| bounded rebuild | newly authored code matched to captured evidence | "matches within the measured diff"; never "exact" without 0-diff |
| visual fallback | canvas/WebGL/native-like UI approximated from screenshots/limited DOM | "approximation; behaviour not equivalent" |

Never call a rebuild exact unless it is direct source reuse. Never claim native-app fidelity from
public web evidence. Never claim offline if core behaviour still calls a remote service.

## Failure/status taxonomy for the final routing
- `ready` — all gates evidenced.
- `manual-review` — passes mechanical gates but has canvas/video/frame/network limits a human must judge.
- `needs-session` — target behind login/app gate; only the public shell was verified. State what
  was NOT verified; never fabricate private views.
- `blocked` — missing primary surface or unrecoverable capture failure. Output
  must not be presented as usable.

## Evidence classes
Report these separately: *captured* (artifact exists), *inferred* (judgement from captured data,
label it), *missing* (could not be obtained, say why). An "inferred" item can support a P2, never a PASS gate.

## Independence rules
- Reviewer re-captures; never reuses the builder's screenshots or reports.
- Reviewer cannot modify the clone or the thresholds. Builder cannot grade own work as the final verdict.
- If the reviewer finds the builder changed masks/thresholds after a failure, that is a P0.
- Residual differences need the user's explicit approval recorded in the report.

## Secrets / PII hygiene
HAR, cookies, storage state, Authorization headers, tokens in query strings and form bodies from
login/checkout/account routes must not be copied into reports or committed. Redact before sharing.

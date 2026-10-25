# QA report template (`.qa/review/report.md`)

```
# Independent QA — <site/slug> — <date>
Reviewer: <agent id>   Builder: <agent id>   Clone mode: <label>
Commands run (with exit codes): ...

## Gate results
| Gate | Result | Evidence |
|---|---|---|
| G1 Captures complete (all viewports, both sides) | pass/fail | paths |
| G2 Sizes + page heights equal | | report.json |
| G3 Pixel diff within target (<target>) | | per-record ratios |
| G4 Runtime health (console/HTTP/images/overflow/canvas/fonts) | | gate.json |
| G5 Behaviour matrix (below) | | |
| G6 Honesty of labels/claims | | |
| G7 Rights/secrets scope | | |

## Findings
| ID | Sev | Where (route/viewport/section) | Observation | Evidence | Suggested owner action |
P0 = wrong/missing structure, broken page, error, false claim, rights/secret problem (blocks)
P1 = visible deviation or replica-only failure a user would notice (blocks)
P2 = minor/inherited-from-reference/anti-alias (reported, not blocking)

## Behaviour matrix
| Interaction | Reference result | Replica result | Match |

## Residual differences accepted by the user (verbatim approval required)
...

## Verdict
PASS | BLOCK
```
Rules: every finding cites an artifact path or a command; no finding without a location; do not
propose loosening a threshold as a fix.

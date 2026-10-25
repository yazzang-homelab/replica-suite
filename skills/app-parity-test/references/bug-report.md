# Bug log (`appclone/bugs.md`)

| severity | means |
| --- | --- |
| S1 | data loss, security hole, wrong payments, core flow blocked |
| S2 | feature broken, no workaround |
| S3 | broken with workaround, or visibly wrong |
| S4 | cosmetic |

```markdown
### B-014  S2  open|fixed   <title>
Flow/case: F01-E2   Screen: S08
Steps: 1. ... 2. ... 3. ...
Expected: ...        Actual: ...
Evidence: screenshot path / console log / failing test name
Fixed in: <commit>   Regression test: e2e/f01.spec.ts "slot in guest zone"
```

Rules: reproduce before logging; unreproduced suspicions go to a "to check" list; ship nothing with an open S1 or S2; every fix keeps its test.

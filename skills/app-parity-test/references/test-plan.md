# Test plan template (`appclone/test-plan.md`)

```markdown
## F01 <flow name>   screens S07 -> S08 -> S09
| case | steps | expected | auto? |
| F01-H1 happy | ... | confirmation shown, row persisted | e2e/f01.spec.ts |
| F01-E1 double submit | click twice fast | one record | e2e |
| F01-E2 time zone | guest in UTC+9, host UTC-5 | slot shown in guest zone | e2e |
| F01-N1 declined card | card ...0002 (provider test card) | error shown, no booking | manual |
```

## Edge checklist per flow
empty input; very long input; emoji/accents; two tabs; double click on submit; back button mid-flow; refresh mid-flow; slow network; offline; expired session; another user's data must be invisible; time zones and DST; 390px width; keyboard only; screen-reader labels; permission denied; deleted record.

## Automation rules
- Playwright, one spec per flow, local server + seed data.
- Selectors: roles/labels (`getByRole('button', {name})`), never CSS classes.
- Every spec: collect `pageerror` and `console.error` and fail on them; fail on 5xx; run axe on each screen.
- Route sweep: every route once, zero errors, screenshots at 390 and 1440 to `e2e/shots/`.
- Assert post-action state after reload, not just that a click did not throw. A screenshot proves it rendered, not that it works.
- Never point tests at the original's servers.
- Expected values that the engine normalises (CSS values, URLs, colours, number formats) are obtained by round-tripping the literal through the same engine, never hand-copied; when a check fails, first ask whether the check (or its environment) is wrong before changing the app.

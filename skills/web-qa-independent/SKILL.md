---
name: web-qa-independent
description: Independent, read-only QA review of a finished website clone by a separate reviewer agent, ending in a strict PASS/BLOCK verdict with P0/P1/P2 findings. Use for "독립 QA", "클론 검수", "리뷰어 에이전트로 검증", "최종 승인 전 체크", "independent reviewer", "release gate for the clone", "don't trust the builder".
---

# web-qa-independent — reviewer who did not build it

The builder cannot grade its own work. This skill defines the second pair of eyes: it
re-measures from scratch, tests behaviour, audits claims, and returns `PASS` or `BLOCK`.

## QA scope and independence gate
- Confirm the user-stated purpose and the clone-mode label before testing.
- Leftover check is part of QA: unreplaced source brand/assets in a rebranded build, leaked cookies/storage state, or analytics/tracking scripts left in are findings.
- Reviewer is read-only on the project. It may write only under `.qa/review/`.

## Workflow
1. **Brief.** Collect: reference URL, replica URL, clone root, claimed mode, routes, viewports,
   accepted dynamic regions, builder's claims. If a claim has no artifact, mark it unverified.
2. **Spawn the reviewer** as a fresh agent (subagent/new session) with
   `references/reviewer-prompt.md` filled in. It must not inherit the builder's captures or
   conclusions. If subagents are unavailable, run the checklist yourself in a clean context and
   say the review was not independent.
3. **Mechanical gate** (reviewer re-runs): fresh captures via
   `web-verify-pixel/scripts/capture_matrix.mjs` for both sides, `pixel_diff.py`, then
   `python3 scripts/qa_gate.py --diff … --replica … --ref … --max-ratio <target> --out .qa/review/gate.json`.
   Exit 2 = BLOCK. Replica-only console/page errors, broken images, size/height/canvas mismatches
   are P0; replica-only HTTP errors and overflow are P1; issues also on the reference are P2.
4. **Visual walk.** Side-by-side full-size screenshots, every viewport, top to bottom; overlays
   for the worst bands. A montage locates drift, full-size crops establish detail.
5. **Behaviour matrix.** Real input (wheel, keyboard, pointer, touch emulation): nav + mobile
   menu, hover/focus, tabs, accordions, carousel boundaries, forms, sticky/pinned scenes both
   directions, smooth scroll, media controls, cloned-route links. Record reference vs replica.
6. **Honesty + scope audit** (`references/evidence-and-honesty.md`): label matches evidence,
   no "exact/pixel-perfect" without 0-diff, external dependencies disclosed, no secrets, no
   hotlinks to the source unless disclosed, rights check.
7. **Report** in `.qa/review/report.md` using `references/report-template.md`; final line is
   exactly `PASS` or `BLOCK`. Status routing: `ready` / `manual-review` / `needs-session` / `blocked`.
8. **BLOCK loop.** Hand findings to the builder (or `web-verify-pixel` auto-fix loop). After fixes,
   the reviewer re-runs ONLY with fresh captures; PASS needs every gate re-evidenced. Max 3
   review cycles, then escalate to the user with the open P0/P1 list.

## Verdict rules
- Any P0 or P1 -> `BLOCK`. P2 only -> `PASS` with the P2 list.
- Builder changed thresholds/masks after a failure without user approval -> P0.
- Residual differences are acceptable only with the user's explicit, recorded approval.
- "Looks fine" and unreferenced assertions are never evidence.

## Outputs
```
<clone>/.qa/review/{reference,replica,diff}/…   fresh captures
<clone>/.qa/review/gate.json                     qa_gate.py result
<clone>/.qa/review/report.md                     findings, behaviour matrix, verdict
```

## References
- `references/reviewer-prompt.md` — prompt for the reviewer agent.
- `references/report-template.md` — report and severity scale.
- `references/evidence-and-honesty.md` — clone-mode labels, status taxonomy, independence rules.
- `scripts/qa_gate.py` — mechanical PASS/BLOCK gate (stdlib; tested).

## Sources
Derived from niuniu122/pixel-perfect-website-clone-skill (mandatory non-editing checker agent
with PASS/BLOCK), xintongw431-arch/webgl-runtime-cloner-skill (P0/P1/P2 QA report, expected-
difference grading), and KeiaiLab/webEmbedding (clone-mode honesty labels, needs-session /
manual-review / blocked routing, secret/PII hygiene).

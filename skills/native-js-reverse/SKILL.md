---
name: native-js-reverse
description: "Front-end JavaScript reverse engineering with browser-debugger tooling: locate how a web app builds request signatures/encrypted parameters, trace XHR/fetch/WebSocket initiators, sample runtime values at minimal intrusion, rebuild the algorithm in Node with evidence-driven environment patching, then optionally deobfuscate. Use for: signature chain, sign/token/encrypted param analysis for your own or authorized site, js-reverse MCP, breakpoint on XHR, env patching (补环境), first divergence. Korean triggers: 프론트엔드 JS 리버싱, 서명 파라미터 분석, 암호화 파라미터 추적, XHR 브레이크포인트, 런타임 샘플링, Node 환경 복원, 난독화 해제."
---

# native-js-reverse

Reconstruct how a page computes a request field (signature, token, encrypted payload) from runtime evidence, then reproduce it locally. Principles: **observe first, hook before breakpoint, breakpoint last, evidence over guessing, rebuild-oriented.**

## When to use
- You need to understand or interoperate with signing/encryption in a web client you own or are authorized to test (own app, contracted audit, documented public API client, CTF).
- Not for native binaries/APKs/DLLs (`native-triage`, `native-ghidra`, mobile skills via `native-index`).

## Authorization gate (do first)
Write `jsre/SCOPE.md`: target origin, owner/authorization basis, purpose. Stop if absent. Do not use results to evade rate limits, anti-fraud/risk controls, paywalls or access controls of third-party services, or to scrape data you may not access. Use test accounts; never log real user credentials. Keep captured cookies/tokens out of committed artifacts.

## Tools
Bind to whatever debugger tooling the host exposes (typical MCP `js-reverse_*` set): new/navigate/select page and frame; list/get/search scripts; list network requests and request initiator; break on XHR; set breakpoint on text; evaluate script; get paused info; pause/resume; websocket messages; screenshot. Record the exact tool-name mapping in `jsre/SCOPE.md` once; if names change, update the mapping rather than guessing. If no debugger tool exists, fall back to browser devtools via Playwright/CDP scripts. Detail: [references/phases.md](references/phases.md).

## Workflow (five phases, each gated)
1. **Observe.** Open the target page, list network requests, pick the request that carries the field, fetch its initiator stack, shortlist scripts via source search (parameter name, `sign`, `encrypt`, `crypto.subtle`, `btoa`, `CryptoJS`).
   - Gate: you can state request URL pattern, where the field appears (query/header/body/cookie), initiator frames, 1+ suspect script URLs.
2. **Capture.** Minimal intrusion: `break on XHR` for the URL; on hit read paused info (stack, locals, arguments); use `evaluate` for light probes; text breakpoints only when needed. Prefer wrapping/hooking functions to log args and return values over stepping.
   - Gate: at least 3 samples of (inputs -> output) including a repeat of identical input, and the call order of the chain. Note time, random, storage, cookie, UA, canvas, crypto dependencies by varying one input at a time.
3. **Rebuild.** Import the target script in Node with the smallest host shim and call the real entry function with captured inputs.
   - Gate: the script runs to the first exception or output.
4. **Patch (env).** One minimal causal patch at a time, driven by the error or first divergence from the page samples: patch values first, then function shells, then return-object contracts. Re-run after each patch, log whether first divergence moved forward. Never pre-build a full fake browser from imagination.
   - Gate: Node output equals page output for all captured samples (fix time/random with recorded values), and for fresh inputs checked against a live page run.
5. **DeepDive (optional).** Only after step 4 is green and when long-term reuse is needed: AST deobfuscation (string-array decoding, control-flow flattening, dead code), then extract the algorithm as a clean pure function with tests built from the samples.

## Fallback order when stuck
breakpoint -> back to request observation; source guessing -> runtime evidence; Node patching -> page evidence; deep deobfuscation -> minimal reproducible chain. Log each retreat.

## Output artifact layout
```
jsre/
  SCOPE.md           authorization + tool mapping
  task.md            running log; every patch decision: what, why, divergence before/after
  samples/*.json     request sample, initiator stack, inputs/outputs (secrets redacted)
  repro/             node entry, shims, run script, expected-vs-actual diff
  report.md          see references/output-contract.md
```
Final report must contain: target request and parameter location; script and function that produce it; evidence sources (request, stack, breakpoint, runtime values); whether reproduction is stable; the single remaining environment gap if unfinished. See [references/output-contract.md](references/output-contract.md).

## Sources
- haikow/claude-reverse-skills (mcp-js-reverse-playbook): five-phase observe/capture/rebuild/patch/deepdive discipline and fallback order. Reimplemented here; no upstream text or code copied (upstream has no licence file).

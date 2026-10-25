# Phase checklists

## Observe
- Reload with network capture on; filter to XHR/fetch/WS; diff requests with/without the field.
- Initiator stack gives the first app-level frame; the signing function is usually 1-4 frames up from the network wrapper (axios/fetch interceptor).
- Source search terms: the field name, `sign`, `token`, `nonce`, `timestamp`, `md5|sha|hmac|aes|rsa`, `crypto.subtle`, `atob|btoa`, `new Function|eval`.
- Output: suspect list with script URL, line, why.

## Capture
- Break on XHR by URL substring; on pause record call stack, arguments, closure/local vars, `this`.
- Wrap candidate function via evaluate: store args/result in `window.__trace`, then read back. Do not alter timing more than needed.
- Vary one thing at a time: same input twice (deterministic?), changed timestamp, changed cookie, changed UA. This produces the dependency list.
- Anti-debug: if debugger statements/timing checks fire, prefer hooks over pauses; note the guard in task.md.

## Rebuild / Patch
- Entry: load script text, define minimal `window/self/global`, run, catch first error.
- Patch order: value (constant), function shell, object contract (property returning expected type). Source the value from page samples only.
- Typical dependencies proven by evidence: `navigator.userAgent`, `document.cookie`, `localStorage`, `Date.now`, `Math.random`, canvas/WebGL fingerprint, `crypto.getRandomValues`, `location`.
- Record per patch: error text, patch, result, first-divergence index before/after.
- Pin nondeterminism: stub time/random with recorded values to compare byte-for-byte, then unpin and verify structure/validity live.

## DeepDive
- Tools: AST parser (babel/acorn) transforms: constant folding, string-array decoder inlining, switch-flattening restoration, unused-branch removal.
- Verify each transform by re-running the sample suite; revert on any output change.

# Scope classification, mirror rules, gates

## Classification tree (first hit wins)
1. **X dead**: final host differs from target host (redirect, domain change), target path 404 (rule out HEAD false-404s), tech-stack era contradicts the work's era, silent replacement (generator/licence years later than original period). Route: archive rescue (CDX index, pick one coherent timestamp window around an anchor page, fetch raw `id_` bytes, record holes as fact). Judge archive coverage per asset layer: crawlers skip JS, so code layer can be fully covered while visual layer is empty.
2. **D server-owned**: heavy WordPress/PHP+DB content, carts, inventory, experiment bucketing, personalization hydrated server side. Decline the server-owned part.
3. **C1 server components with inlined output** (Next.js RSC flight stream in every HTML page): decode the flight stream as the spec, rebuild client components faithfully, server components as explicitly registered inferences, close with a semantic gate (module-id bijection).
4. **C2 declarative client frameworks** that ship source (R3F, Vue SFC compiled output): treat as A; slicers work on bytes, not paradigms.
5. **B platform layer** (Shopify, CMS-hosted assets, runtime API snapshots, SSG payload expansion): strip platform layer, snapshot API responses used at runtime.
6. **A**: client-owned behaviour in static assets.
Write a one-sentence verdict and which step broke first in `probe/verdict.md`.

## Mirror rules
- Layout mirrors the URL space: `<path>/index.html`; external hosts under `assets/<host>/<path>`; one url->path function shared by crawler, capture, server and gates (one implementation, not two lookalikes).
- Four passes: regex BFS crawl; real-browser network capture; static solving of runtime-built URLs in bundles; closure check. Plus real status code per URL; `redirect: manual`.
- Headers can change the resource (image `Accept` negotiation, optimizer endpoints, content-encoding); record which variant you hold.
- A wrong-split URL does not miss a resource, it invents one; filenames may contain `(`, `..` guard must not reject legal names.
- Analytics beacons are reports, not assets: register as external, block at serve time.
- Authenticity gate: HTTP 200 + `text/html` can be a bot challenge, consent wall, geo block or catch-all; ledger/closure/injectivity checks all pass on the wrong content, so test authenticity separately.
- Ledger is not evidence by itself: verify disk against ledger, and ledger against what the server returns.
- Archive policy: commit the ledger; the bytes themselves are the user's call (size/rights).

## Gate catalogue (cheap -> expensive, keep lower gates green forever)
| gate | asserts |
| --- | --- |
| mirror self-check | ledger<->disk, closure empty, authenticity, coverage |
| offline run | zero 404, zero console errors, zero external requests, incl. audio/video/fonts/workers/beacons |
| DOM/SSR byte | rendered HTML equals source HTML after replaying declared transforms |
| token-equivalence | emitted/reformatted code token stream equals the original per module |
| routes | route/redirect/status contract |
| numeric probe | same keyframes into both sides; compare tween values/easing point by point |
| cross-side | identical inputs through mirror and port seams, compare outputs; URLs must differ or fatal |
| quantized pixel | state-aligned screenshots, self-noise band first (`--self` 4+ runs per side), non-empty-frame precondition, checkpoint walk across scroll positions |
| clean probe | no console errors, no failed requests, no off-origin traffic |
| cold-head audit | each module/declaration cited, overridden or named; reports `n/N examined` |
| module-map / symbols / reassembly | one module per file equals bundler bytes; every port declaration has exactly one src counterpart; sliced parts concatenate byte-identical |
| freshness / standalone | src->dist->site synced; copy src to temp dir, offline install+build, still clean |
| zero-dependency | scripts import only `node:` and relative; no gate imports a refactorer |
Also gate every output surface, including sound; all-green on one state hides unexercised states, and a masked-out region hides the difference.

## Determinism freeze
Take over rAF, timers, clock, `Math.random`, IntersectionObserver; pump to arbitrary t; inject the same shim at the same point on both sides; settle on page state, not wall clock; mask truly live content (video, clocks) explicitly and record the mask.

## Registers (tables are assertions: each needs a gate that checks it against the artifact)
- **Deviation**: id | source does | we do | why | revisit when.
- **Quirks**: source behaviour that looks like a bug | line ref | kept/changed.
- **Rename map** (L3): port position -> old name -> new name -> evidence tier.
- **Milestone log**: output | verification | lesson | next breakpoint (with line numbers).

## Rights forensics (facts for the user's decision)
Per asset: owner, licence, third-party marker, whether the origin is still operating, identifiers inside the product. Present as: facts / unclear points / options / risk boundary per option / recommendation + current default action ("until you decide, nothing is published"). Do not phrase as a legal conclusion either way.

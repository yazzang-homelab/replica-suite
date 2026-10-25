---
name: app-index
description: Router for whole-application analysis and clean-room re-implementation skills (recon, spec, build, parity/QA, brand+deploy, binary/APK/Electron internals, forensic high-fidelity rebuild). Use when the user says "앱 클론", "앱 복제", "앱 재구현", "앱 분석 어디서부터", "clone an app", "rebuild X", "reverse engineer an app", "which app-* skill", or when unsure which app- skill applies.
---

# app-index

Read and apply the [common execution contract](../../references/common-contract.md), then pick the skill by intent. All `app-*` skills share the working folder `appclone/`. Distinguish clean-room rebuilding from site migration.

## Intent -> skill
| user intent | skill |
| --- | --- |
| "clone/replicate this app", "map its screens and flows", "what do users hate", "is an alternative worth building" | `app-recon` |
| "plan the stack/schema/API", "design tokens from screenshots", "feature matrix to architecture" | `app-spec` |
| "build it", "implement screen S07", "turn these screenshots into an app" | `app-build` |
| "how close is it", "QA/test", "visual diff", "parity score", "is it shippable" | `app-parity-test` |
| "name/rebrand it", "leftover check", "landing page/pricing/store listing", "deploy/ship it" | `app-brand-deploy` |
| "analyze this binary/APK/asar/exe", "compare two builds", "what does the shipped app do internally" | `app-internals` |
| "1:1 / pixel-accurate rebuild", "migrate my own site", "restore a dead site", "reproduce exact animation timing" | `app-forensic-rebuild` |

## Standard pipeline
```
app-recon -> app-spec -> app-build -> app-parity-test -> (loop to app-build for gaps)
          -> app-brand-deploy
app-internals  feeds evidence into app-recon / app-spec
app-forensic-rebuild  is a separate high-fidelity track (site migration, archival rescue, exact motion)
```
Each stage reads the previous stage's files in `appclone/` and ends at a verification gate; do not skip a gate or call a stage done while it fails. Ask the user only at: start (target, mode, slice), research verdict (go/no-go, angle), design direction, name pick, go-live.

## Modes (decide in app-recon)
`full app` - `single feature into an existing app` - `site migration` (direct porting) - `forensic` (use app-forensic-rebuild).

## Upstream -> skill map
| upstream repo | primary skill(s) |
| --- | --- |
| morluto/rea | `app-internals` (evidence ledger, routing, Electron/APK/native playbooks); informs gates in `app-forensic-rebuild` |
| Jakeschincariol/replica-skill | `app-recon`, `app-spec`, `app-build`, `app-parity-test` (parity.py, imgdiff.py), `app-brand-deploy` (shared brand CLI) |
| thenavidm/remaster | `app-recon` (pain research, clean-room line), `app-spec` (design system), `app-parity-test` (critic bars), `app-brand-deploy` (launch stage), `app-build` (modes) |
| Birkenpapier/ai-app-cloner | `app-recon` (screenshot mode), `app-build` (spec files, on-device vs backend), `app-parity-test` (verify harness, visual-diff loop) |
| boyang-hu/website-rebuild-skill | `app-forensic-rebuild`; gate ideas in `app-parity-test`; default-private posture in `app-brand-deploy` |

Web-page-only cloning (single marketing pages, screenshot-to-code, WebGL runtime) is covered by the sibling `web-*` skills; mobile-specific and native-RE categories by their own prefixes.

## Sources
Derived from: morluto/rea, Jakeschincariol/replica-skill, thenavidm/remaster, Birkenpapier/ai-app-cloner, boyang-hu/website-rebuild-skill.

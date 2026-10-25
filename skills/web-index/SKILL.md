---
name: web-index
description: Router for the web- category — analyzing, capturing, rebuilding, mirroring, verifying and documenting existing websites. Use first for "웹사이트 클론", "사이트 복제", "웹 분석", "디자인 시스템 추출", "픽셀 비교", "WebGL 사이트", "clone this website", "replicate a web page", "which web skill should I use".
---

# web-index — website clone / analysis router

Pick the skill by intent. Most clones follow one pipeline; jump in at the stage you need.

## Common contract (applies to every web- skill)
Read and apply the [common execution contract](../../references/common-contract.md).
Label exact reuse, runtime mirror, clean-room rebuild and visual fallback separately.

## Intent -> skill
| User intent | Skill |
|---|---|
| "Analyze this site before we touch code" (sitemap, structure, assets, motion, brief) | `web-firecrawl-analyze` |
| Capture raw vs rendered HTML, screenshots, fonts, assets, chunks; recon step 1 | `web-capture` |
| Computed styles, design tokens, hover/scroll/animation analysis, per-section specs | `web-extract-styles` |
| Write a DESIGN.md / style guide / design-system doc from a URL (no rebuild) | `web-design-md` |
| Rebuild the site as React/Next/Vite, section by section with parallel builders | `web-build-parallel` |
| Mirror a page locally as static files, then swap brand/copy/assets | `web-mirror-rebrand` |
| 3D / WebGL / Three.js / Rive / canvas / scroll-scrubbed scenes | `web-webgl` |
| Screenshot matrix, pixel diff, "find and fix differences until it matches" | `web-verify-pixel` |
| Independent reviewer, PASS/BLOCK release verdict, "don't trust the builder" | `web-qa-independent` |

## Typical pipelines
- **Rebuild:** `web-firecrawl-analyze` or `web-capture` -> `web-extract-styles` -> `web-build-parallel`
  -> `web-verify-pixel` (loop) -> `web-qa-independent`.
- **Mirror + rebrand:** `web-capture` -> `web-mirror-rebrand` -> `web-verify-pixel` -> `web-qa-independent`.
- **Canvas-heavy site:** `web-webgl` (probe -> mirror or clean-room scene spec) -> `web-verify-pixel`
  in a controlled state -> `web-qa-independent`.
- **Documentation only:** `web-design-md` (optionally after `web-extract-styles` evidence).
- **Screenshot-only input (no live URL):** use the shot- category router if present; return here
  for verification.

## Sources / upstream -> skill mapping
| Upstream repo | Primary skill(s) |
|---|---|
| santowilem/skills | `web-capture`, `web-extract-styles`, `web-mirror-rebrand`, `web-build-parallel` |
| braxtonROSE4/clone-any-website | `web-capture`, `web-extract-styles`, `web-mirror-rebrand`, `web-build-parallel` |
| yournextstore/yournextstore | `web-capture`, `web-extract-styles`, `web-build-parallel`, `web-mirror-rebrand` |
| julianromli/ai-skills | `web-capture`, `web-extract-styles`, `web-build-parallel` |
| ericshang98/perfect-web-clone-skill | `web-capture`, `web-extract-styles`, `web-build-parallel`, `web-mirror-rebrand` |
| Core-Mate/Pixel-Perfect-Web-Replica | `web-capture`, `web-extract-styles`, `web-build-parallel`, `web-mirror-rebrand` |
| niuniu122/pixel-perfect-website-clone-skill | `web-verify-pixel`, `web-qa-independent` |
| KeiaiLab/webEmbedding | `web-qa-independent`, `web-firecrawl-analyze`, `web-verify-pixel` |
| xintongw431-arch/webgl-runtime-cloner-skill | `web-webgl`, `web-qa-independent` |
| Paidax01/web-to-design-md | `web-design-md` |
| Amanuel2x/clone-skill | `web-firecrawl-analyze`, `web-design-md`, `web-verify-pixel` |
| JCodesMore/ai-website-cloner-template | `web-firecrawl-analyze`, `web-verify-pixel`, `web-design-md` |
(Repos 01-05 are whole-product/app cloners and live in other category indexes; repo 11 is absent.)

## Shared conventions across web- skills
- Evidence layout: `<clone>/{reference,replica,diff,.qa}`; analysis in `docs/research/<slug>/`.
- Default breakpoints: 1920x1000, 1440x1000, 1024x1000, 768x1000, 375x812 (+ the site's own).
- Gates are mandatory: do not skip to build without capture evidence; do not claim done without diff
  numbers; builder never signs off its own work when independent QA is requested.
- Scripts are original or MIT-credited; use Node + Playwright and Python 3, with Pillow for section slicing.
  Ask before installing anything.

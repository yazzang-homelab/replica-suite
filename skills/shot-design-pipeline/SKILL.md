---
name: shot-design-pipeline
description: Design-first pipeline from a brief or reference image to a built site - write a locked blueprint, generate a UI mock-up with an image tool, get confirmation, export separate clean assets, then implement and QA against the approved mock-up (optional deploy). Use for "디자인 시안 만들고 구현", "레퍼런스 이미지로 웹사이트 제작", "목업 생성 후 코드화", "랜딩 페이지 시안부터", "design mockup to website", "reference image to site", "generate UI design then build it", "blueprint then build".
---

# shot-design-pipeline - brief -> blueprint -> mock-up -> assets -> build -> QA

For work that starts **before** a screenshot exists (or uses an image only as mood/reference). The approved mock-up becomes the source of truth; from there the build is the same render-compare loop as any screenshot clone.

> Blueprint is the contract. The mock-up is the preview. Code is the output. Nothing is decided during the build that was not decided in the blueprint.

## When to use
- "Design a dashboard / landing page / app screen and build it", or "use this photo/screenshot as the style reference for a new site".
- Existing screenshot **to be restyled** or extended (fixed sidebar/nav kept, content redesigned).
- Not for: faithful clones of an existing screenshot -> `shot-analyze` + `shot-to-*`.

## Clean-room and deployment gate
- Reference images are inspiration for composition, palette, mood, typography class - **not** for copying a brand, logo, copy, layout 1:1 or characters. Replace names, marks and text with the user's own.
- Image generation uses the host's built-in tool or the service the user names; do not switch to a paid service or enter credentials without the user's say-so. Missing capability -> say what is missing, offer CSS/SVG/stock fallbacks.
- Deployment (Vercel etc.), domain/DNS, account login: **only on explicit request**; never run `vercel --prod` or similar unprompted.

## Workflow
```
- [ ] 1 Brief (<=3 questions)           - gate: page goal, audience, fixed regions, content truth
- [ ] 2 Analyze reference(s)            - shot-analyze on any image; extract intent, not pixels
- [ ] 3 Blueprint (written, complete)   - gate: every value decided
- [ ] 4 Mock-up generation              - gate: image opened and checked at logical viewport
- [ ] 5 PAUSE: user confirms mock-up    - nothing built before "go"
- [ ] 6 Asset export (separate files)   - gate: alpha/cleanliness checks pass
- [ ] 7 Build from blueprint + assets   - shot-to-web / shot-to-unocss / shot-to-rn
- [ ] 8 Compare + QA ledger             - shot-compare-iterate; viewports; score
- [ ] 9 Handoff (optional deploy)
```

### 1 Brief
Ask only what blocks: which page and its core task; existing screenshots/mock-ups; regions that must not change (sidebar, header). Otherwise proceed with stated defaults. Never invent clients, metrics, certifications, testimonials - label sample data as sample. Make sample numbers internally consistent (counts, totals, dates).

### 2 Reference strategy
| Situation | Use of reference |
|---|---|
| no image, exploring | none; choose one visual idea from the task |
| keep nav/sidebar | name the fixed area; neutral-content copy of the reference for the generator, keep the original |
| borrow style | extract type/proportion/space/color relations, restate for the new business; do not paste foreign sections |
| exact restyle/extension | full screenshot + explicit fixed areas; same base image for every sibling screen |
Only say "image-conditioned" if the image bytes were actually passed to the tool; otherwise it was a text paraphrase.

### 3 Blueprint
Write [references/blueprint-template.md](references/blueprint-template.md) completely before generating: visual thesis (one sentence), content plan, interaction thesis, tokens (colors with roles, fonts, scale, spacing, radius, shadow), grid/container, section specs, **asset slots** (type, ratio, background policy, prompt), pages, interactions, stack. Viewport (logical px), document height and generated pixel size are recorded separately - a 1024px-wide generated image is not a phone layout width.
Design bar: composition before component count; one dominant idea; calm text area on image-led heroes; cardless by default unless content needs cards; avoid generic SaaS grid, stat strips, logo clouds, purple gradients, emoji icons; <=2 type directions, one dominant accent; allow purposeful asymmetry/overlap and say how it collapses on narrow screens; no fake dashboards unless the product is one.

### 4 Mock-up
Compose a focused prompt from [references/mockup-prompting.md](references/mockup-prompting.md) (object + task, canvas, concept, content with exact sample data, rules, adaptation). Landing pages: full vertical page from nav to footer at desktop width; if the tool cannot make a readable long image, generate sections of equal width/scale (stable section IDs, nav only at top, footer only at end), check seams, then assemble. Multi-screen/state flows: one checked base image, then derive; record actions, data changes and which regions stay identical. Open the result and check text legibility, density, consistency; reject header-only, blurry, crowded, tiny-text, or unfaithful outputs. The mock-up is **raster text, not working UI**: say so.

### 5 Confirmation
Show mock-up + blueprint summary (palette, fonts, sections, assets to produce, stack). Wait for go/adjust. Changes go into the blueprint first, then the mock-up.

### 6 Asset export
Follow [references/asset-export.md](references/asset-export.md): classify code-native vs image assets (text, buttons, nav, forms, plain cards = code; photos, illustrations, hero art, textures, logos = assets); one file per asset, never a sheet; isolated assets have no page background; transparent assets verified with `node scripts/check_alpha.mjs file.png --require-transparency` (needs `pngjs`); manifest with role, alpha flags, accessibility note; keep source kit untouched.

### 7 Build
Hand blueprint + tokens + asset manifest to the matching builder: web -> `shot-to-web`, segmented fidelity -> `shot-to-unocss`, phone app -> `shot-to-rn`, native -> `shot-to-qml`. Rules: all values from the blueprint (no stray hex), local assets only, real `alt`, every blueprint interaction implemented functionally, no placeholder boxes, no invented sections, no decisions during build.

### 8 Compare + QA
Run `shot-compare-iterate` against the mock-up at desktop/tablet/mobile (1440 / 768 / 390, plus iPad 1024x1366 when relevant). Fill a QA ledger (>=8 concrete comparison points: copy, layout, type, palette, assets, icons, spacing/container, responsive, interactions) and score the rubric in [references/qa-rubric.md](references/qa-rubric.md). Build must pass; console clean.

### 9 Handoff
Report files/routes, assets used and their provenance, tokens, QA ledger + score, remaining risks (fonts, assets), run commands. Deploy only if explicitly requested.

## Outputs
```
design/blueprint.md  design/mockups/*.png  design/brief.md
asset-exports/<slug>-<date>/{01-logos,02-icons,03-ui,04-backgrounds,05-page-assets,06-ready,notes,manifest.json}
src/** (build)   visual-qa/{reference,screenshots,diffs}   docs/QA_LEDGER.md  docs/QA_SCORE.md
```

## Sources
vishnu-madhavan-git/9designer-skills (blueprint-first flow, confirmation pause, asset kit/export/manifest, QA ledger/benchmark rubric, token scales), oil-oil/draw-ui (brief and reference strategy, code-vs-asset split, long-page segmentation and assembly, multi-state discipline, no fake percentages - reimplemented), fitoe/DesignToCode (asset fulfilment, atlas rules), onewave-ai/claude-skills and glebrati-cloud/screenshot-to-code (token/component extraction, pattern library), sevzq/screenshot-to-html (render-compare loop).

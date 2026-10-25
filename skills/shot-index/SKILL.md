---
name: shot-index
description: Router for the screenshot/image-to-UI-code skill family (shot-*) - pick the right skill for turning a screenshot, mockup, phone app capture or design brief into HTML, React/Vue/Svelte, UnoCSS pages, React Native, Qt QML, or a generated design pipeline. Use for "스크린샷 코드 변환 어디서 시작", "이미지로 UI 만들기", "시안 구현 스킬 추천", "which skill for screenshot to code", "image to UI index", "shot skills overview".
---

# shot-index - screenshot / image -> UI code router

Start here when the input is an **image** (screenshot, mockup, Figma PNG export, phone capture, reference photo) and the output is UI code or a design.

## Authorization / clean-room gate (applies to every shot-* skill)
Read and apply the [common execution contract](../../references/common-contract.md). For image-only inputs, explicitly state which interactions, hidden states and responsive rules cannot be recovered from pixels.

## Intent -> skill
| User intent | Skill |
|---|---|
| "Analyze this screenshot", extract colors/fonts/spacing/layout, write a spec | `shot-analyze` |
| Screenshot -> HTML/CSS, Tailwind, React, Vue, Svelte, Next.js | `shot-to-web` |
| Segmented page images -> Vue/Astro + UnoCSS in an existing repo, high fidelity, brief + section diff | `shot-to-unocss` |
| Phone app screenshots (screens/states) -> Expo / React Native app | `shot-to-rn` |
| Screenshot or HTML -> Qt Quick / QML (PySide6, C++, kiosk, embedded) | `shot-to-qml` |
| "It doesn't match", render vs target, visual diff, responsive/state QA | `shot-compare-iterate` |
| No screenshot yet: brief or mood image -> mock-up -> assets -> built site (+ QA) | `shot-design-pipeline` |

## Standard chains
1. Web clone: `shot-analyze` -> `shot-to-web` -> `shot-compare-iterate`.
2. High-fidelity repo work: `shot-analyze` -> `shot-to-unocss` (brief gate) -> `shot-compare-iterate`.
3. Mobile app: `shot-analyze` (clustering, tokens) -> `shot-to-rn` -> `shot-compare-iterate` (+ `rn-verify`).
4. Native desktop/kiosk: `shot-analyze` -> `shot-to-qml` -> `shot-compare-iterate` (non-DOM branch).
5. Design from scratch: `shot-design-pipeline` -> (builder above) -> `shot-compare-iterate`.

## Quick decision guide
- Do you have the image? No -> `shot-design-pipeline`. Yes -> continue.
- Is there an existing repo with Vue/Astro + UnoCSS and fidelity expectations? -> `shot-to-unocss`. Otherwise web -> `shot-to-web`.
- Phone app, many screens/states, needs navigation and working local interactions? -> `shot-to-rn`. Single mobile web screen? -> `shot-to-web` at 390px.
- Qt/embedded mentioned? -> `shot-to-qml`.
- Need numbers or tokens only? -> `shot-analyze`.

## Shared tooling (paths relative to skills/)
| Script | Skill dir | Needs |
|---|---|---|
| `shot.mjs` (render, `--verify`, `--states`), `compare.mjs`, `capture_visual_qa.mjs`, `compare_visual_qa.mjs` | `shot-compare-iterate/scripts` | shared Playwright runtime, `pngjs`, `pixelmatch` |
| `probe.py`, `crop.mjs` | `shot-analyze/scripts` | `opencv-python-headless numpy`; none for crop (`sharp` or macOS `sips`) |
| `asset-policy/*.mjs` | `shot-to-unocss/scripts` | `sharp` |
| `rn-verify.mjs` | `shot-to-rn/scripts` | shared Playwright runtime |
| `check_alpha.mjs` | `shot-design-pipeline/scripts` | `pngjs` |

## Upstream repo -> skill mapping
| Upstream | Used by |
|---|---|
| sevzq/screenshot-to-html | `shot-analyze`, `shot-to-web`, `shot-compare-iterate` (scripts) |
| onewave-ai/claude-skills (screenshot-to-code only) | `shot-to-web`, `shot-analyze`, `shot-compare-iterate` |
| glebrati-cloud/screenshot-to-code | `shot-to-web`, `shot-analyze` |
| oil-oil/draw-ui | `shot-design-pipeline`, `shot-analyze` (calibration), `shot-compare-iterate` (ideas only; no scripts copied) |
| fitoe/DesignToCode | `shot-to-unocss`, `shot-analyze`, `shot-compare-iterate` |
| ozaysahin/screenshot-to-qml | `shot-to-qml`, `shot-analyze` (probe.py) |
| vishnu-madhavan-git/9designer-skills | `shot-design-pipeline`, `shot-compare-iterate` (QA scripts) |
| Birkenpapier/ai-app-cloner (screenshot mode) | `shot-to-rn` |

## Sources
All upstream repos listed in the mapping above; each skill's own Sources section names the exact repos it derives from. For site-capture (live URL) cloning use the `web-*` skills instead; for app reverse engineering use the `app-*` skills.

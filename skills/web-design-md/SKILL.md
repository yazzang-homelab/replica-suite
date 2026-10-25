---
name: web-design-md
description: Turn a live website into a reusable DESIGN.md covering palette, typography, components, layout, motion, responsive rules and agent prompts, plus an HTML preview using DOM/computed-style evidence. Use for "DESIGN.md 만들어줘", "사이트 디자인 시스템 추출", "스타일 가이드 문서화", "look and feel 분석", "extract design tokens from this site", "write a style guide from URL" — documentation, not rebuilding the page.
---

# web-design-md — website to DESIGN.md

Goal: another agent can build new pages in the same visual language without seeing the site.
This is documentation of a design system, not a clone. For rebuilding pixels use `web-extract-styles`
+ `web-build-parallel`; for token extraction feeding a build use `web-extract-styles`.

## Clean-room gate
- Document what is observable from the rendered DOM and stylesheets; a login shell is not the inner app.
- Output is a description of rules (colours, scales, behaviours), not copied assets. Do not copy long copy, logos, icon files, font binaries or trademarks into the deliverable; name fonts and roles instead.

## Workflow
1. **Scope.** Normalise URLs; default outputs `DESIGN.md` and `DESIGN-preview.html` in the user's
   folder (honour custom names). Multiple URLs: inspect each, merge only if the language is shared.
2. **Browser.** Use whatever browser-eval capability exists (agent-browser eval, Playwright MCP
   `browser_evaluate`/`browser_run_code`, DevTools). Prefer in-page evaluation over raw HTTP fetches
   and over screenshots. If no browser is available, help install one (ask first) rather than
   guessing from static HTML.
3. **Baseline** (`references/reading-checklist.md`): open at 1440, wait for hydration, scroll the page
   twice, repeat at 390 (and 768 if layout changes). Note sticky layers and consent banners.
4. **Evidence.** Run `scripts/extract_design_evidence.js` per viewport and per theme; save the JSON
   to a scratch path (`/tmp` or `.web-design/evidence/`), NOT next to the deliverables unless asked.
   Gate 1: custom properties/observed colours/type scale non-empty; unreadable stylesheets listed.
5. **States and behaviour.** Probe hover, focus-visible, active, disabled, sticky/scrolled, expanded
   and theme toggle via real events + computed-style diffs. Record only properties that changed.
   Identify smooth-scroll/animation libraries and what is scroll-, hover-, click- or time-driven.
6. **Voice.** Capture headline style, CTA phrasing, sentence density with short quotes only.
7. **Synthesize** into the structure of `references/design-md-template.md`. Translate technical values
   into roles ("Interactive/hover = #xxxxxx on 120ms ease"), keep exact values, tag `[observed]`
   vs `[inferred]`, document light/dark when toggleable, include a prompt guide with examples.
   Do not dump CSS; do not round to framework defaults.
8. **Lint.** `python3 scripts/lint_design_md.py DESIGN.md --evidence <evidence.json>` — fix missing
   sections, placeholders, and any colour not traceable to evidence.
9. **Preview.** `python3 scripts/render_preview.py DESIGN.md` writes a self-contained
   `DESIGN-preview.html` (swatches, font samples, raw markdown). Skip only if the user opts out.
10. **Spot-check.** Re-measure 5 random tokens live; build one throwaway component from the doc and
    compare visually. Fix drift before delivering.
11. **Report:** file names, the 3-5 defining traits, evidence gaps (auth walls, cross-origin CSS,
    unreachable states). Keep the target folder clean: no stray notes/evidence files.

## Outputs
```
DESIGN.md                 (deliverable)      DESIGN-preview.html   (deliverable)
<scratch>/evidence-<vp>-<theme>.json         (not delivered unless requested)
```

## Rules
Observed vs inferred are labelled; hidden/unreached components are never invented; multiple pages
with divergent styles get a per-page deviations section; app-like sites also document shell,
density, tables, filters, empty/error states.

## References
- `references/design-md-template.md` — section structure and quality bar.
- `references/reading-checklist.md` — passes, tokens, states, themes, verification.
- `scripts/extract_design_evidence.js` (in-page), `scripts/lint_design_md.py`, `scripts/render_preview.py`.

## Sources
Derived from Paidax01/web-to-design-md (agent-browser eval-first extraction, theme-mode sweep,
Stitch-style DESIGN.md sections, HTML preview deliverable; upstream has no licence so all scripts
and templates here are original) with extraction ideas from Amanuel2x/clone-skill (token
extraction pass) and JCodesMore/ai-website-cloner-template (measure declared values, vary
viewport/state to learn the rule).

# DESIGN.md structure

Write for a design-engineering agent that has never seen the site and must build new pages in
the same visual language. Prefer exact values with roles over prose. Tag claims `[observed]`
(read from DOM/CSS/computed style) or `[inferred]` (judgement). Never invent hidden states.

```
# Design System: <Site/Product name>
> Source: <url(s)> · captured <date> · viewports <list> · themes <light/dark/single> · confidence <high/med/low>

## 1. Visual Theme & Atmosphere
2-4 sentences: mood, density, contrast, personality. Then **Key Characteristics** (5-8 bullets,
each testable: "hairline 1px borders instead of shadows", "all-caps eyebrow labels 12px/0.08em").

## 2. Color Palette & Roles
Table: Token | Value (hex + rgb/oklch as authored) | Role | Where used | Source (var name / observed uses)
Groups: Primary · Interactive (link/hover/active/focus ring) · Neutral scale · Surface & overlay ·
Semantic (success/warn/error) · Gradients. 
### Theme Modes (only if the site has them)
Light and Dark tables; list tokens that invert vs stay stable; note imagery/shadow/code-block changes.

## 3. Typography Rules
Font family stack per role (+ where loaded: Google Fonts / self-hosted / system; weights actually loaded).
Hierarchy table: Role | size/line-height | weight | letter-spacing | transform | colour | sample.
Principles: wrapping behaviour, max line length, numerals, heading rhythm.

## 4. Component Stylings
Buttons (primary/secondary/ghost: bg, colour, border, radius, padding, font, height, hover, active,
focus, disabled, transition) · Cards & containers · Inputs & controls · Navigation (desktop, scrolled,
mobile) · Badges/chips · Image treatment (radius, crops, aspect ratios, overlays) · Distinctive components.
Each with exact values, states, and the DOM pattern if non-obvious.

## 5. Layout Principles
Spacing scale (base unit + steps) · Container max-widths and gutters · Grid/column rules · Section
vertical rhythm · Whitespace philosophy · Radius scale · Z-index/stacking layers.

## 6. Depth & Elevation
Shadow/border/blur recipes by level, with exact CSS. State which elevation each component uses.

## 7. Motion & Interaction
Easing curves, durations, stagger; scroll/hover/click/time drivers; smooth-scroll library; reduced-
motion behaviour; what is animated on enter. Mark unverifiable parts.

## 8. Responsive Behavior
Breakpoints (from @media actually found), what collapses/reorders at each, touch target sizes,
nav pattern changes, type scaling, image swaps.

## 9. Do's and Don'ts
6-10 each, concrete and derived from the observations (not generic design advice).

## 10. Agent Prompt Guide
Quick colour reference (name: hex) · One-paragraph style summary · 3-5 example component prompts
that cite tokens · A ready-to-paste "build in this style" prompt · Iteration guide
(what to tweak first when output feels off).

## Appendix (only if valuable)
Content & voice patterns (headline style, CTA phrasing, sentence density) · Observed pages ·
Evidence notes / gaps (what was not accessible, which values are inferred).
```

## Quality bar
- Every colour/size/radius in the doc exists in the evidence JSON; no rounded-to-Tailwind guesses.
- Roles explain *why* a token exists, not only what it is.
- Dark/light both documented if toggleable, else say "single theme".
- At least one prompt example per major component family.
- Gaps section is honest: auth walls, hover states not reachable, cross-origin stylesheets.
- Length follows evidence: if the site exposed more detail than the doc holds, expand.

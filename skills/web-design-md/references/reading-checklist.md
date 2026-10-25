# Site reading checklist (DOM/CSS-first)

Evidence order: 1) rendered DOM of representative nodes, 2) custom properties + readable
stylesheet rules, 3) computed styles, 4) state diffs (hover/sticky/expanded/theme), 5) screenshots
only to disambiguate. Static HTML fetches are supporting evidence only (hydration, hover and
responsive rules change the truth).

## Pass 0 — scope
Page purpose (marketing/product/docs/dashboard/ecommerce/editorial), top-to-bottom section list,
gated areas (document, don't invent), multiple URLs -> inspect each, merge only if the language is shared.

## Pass 1 — baseline
Open at 1440 wide, wait for hydration, scroll the whole page slowly twice (first for rhythm, second
collecting), return to top. Repeat at 390 (and 768 if the layout changes there). Note sticky/fixed
layers, announcement bars, cookie banners (dismiss and note).

## Pass 2 — run `scripts/extract_design_evidence.js`
Per viewport and per theme. Save JSON outside the deliverable folder. Cross-origin stylesheets
appear in `unreadableStylesheets`: fall back to computed styles for those, say so in Evidence notes.

## Pass 3 — tokens to settle
primary/secondary/accent · surfaces · borders · text levels · focus ring · font families and the
weights really loaded (`document.fonts`) · type scale (size/line-height/letter-spacing triples) ·
spacing rhythm (base unit, repeated steps) · radius scale · shadow recipes · gradients/backgrounds
motifs · transition durations/easings · z-index layers.

## Pass 4 — components and states
Navigation · hero · buttons/links · cards · badges · forms/inputs · tabs/pills · accordions ·
tables · footer. States: default, hover, active/selected, focus-visible, disabled, scrolled/sticky,
open/expanded. Probe with real hover/focus (or dispatch events) and re-read computed style; record
only properties that changed.

## Pass 5 — behaviour
What changes on scroll (header shrink, reveal), hover, click, theme toggle; carousel/tab drivers
(click vs scroll vs time); speed/feel (restrained, snappy, cinematic); smooth-scroll lib (`lenis` class).

## Pass 6 — voice
Headline style, CTA phrasing, sentence density, trust signals, naming patterns, technical vs
playful. Quote short examples; do not copy long copy.

## Pass 7 — themes
Toggle light/dark in the page; re-run the extractor; note inverted vs stable tokens and imagery
treatment changes. `prefers-color-scheme` emulation if no toggle.

## Dynamic apps
Document navigation model, density, tables/panels, filters, forms, empty/loading/error states,
shell logic. Only public/accessible surfaces; a login shell is not the private app.

## Verification of the finished doc
Pick 5 tokens at random and re-measure them live; build one throwaway component from the doc and
compare against the site visually; list unresolved gaps.

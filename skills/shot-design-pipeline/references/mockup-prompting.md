# Mock-up prompting and checking

## Prompt skeleton (use what applies, keep it focused)
```
Object and task: <who, on what device, doing what>.
Scope and canvas: <single screen | scroll | full long page nav->footer>, logical viewport <w>x<h>, output ratio/pixels.
Visual idea: <one concrete composition/typography/colour relation tied to the product - not "premium, modern">.
Content: <region order, exact copy, exact sample data>.
Rules and bounds: <fonts available in reality, hex palette, key sizes, asset scope, what stays fixed vs may change>.
Adaptation: <long text, narrow screens, fixed regions that matter to this image>.
```
- Positive description first; add only restrictions that matter for this image. Straight-on view; no device frames, perspective or outside-the-page decoration unless a showcase image is requested.
- Analogies describe experience or organisation ("a music workstation's information density"), not stacked style names. If a word brings unwanted objects (paper texture, lifestyle props), drop the ambiguity instead of piling modifiers.
- Split font references into letterform, weight, proportion and spacing; use fonts that really exist.
- Do not fix exact column counts/coordinates before the idea works; sizes are for usability and consistency.

## Long pages
Block list with stable IDs and purposes before drawing; keep desktop width. Capability-check the tool's sizes (do not retry untested giant canvases). If sections are generated separately: same pixel width, same logical width, fonts, container and component scale; first section generated and checked first; per-section prompt names the IDs, whether nav/footer is included, no repeated headings at seams. Assemble only non-overlapping equal-width parts (no auto-crop, stretch or filler); open the whole page and each segment at logical scale afterwards. Respect authorised generation counts - no silent unlimited retries.

## Multi-state flows
Record action, data change and control state between adjacent screens first; shared nav/components follow one rule; rewards/counters/progress derive from one record; cancel/error never pre-updates results. A multi-panel overview shows flow only (readable text per cell), not a prototype. Derive sibling screens from the same checked base image unless testing chain edits. Model comparisons: freeze prompt, parameters, reference bytes and order; same inputs both sides; do not redraw only the failing side; do not generalise one sample.

## Check the result (open the image)
| Check | Judge by |
|---|---|
| text legibility at logical scale | zoom to 100% of the logical viewport |
| density and hierarchy | first glance focus, secondary info weight |
| consistency | repeated components, spacing, alignment base |
| data coherence | counts/totals/dates agree; copy fits its controls |
| implementability | assets separable; shadows/effects reproducible; no baked UI text you need as real text |
Reject and regenerate with a named fix; compare with the previous version for gains and losses.

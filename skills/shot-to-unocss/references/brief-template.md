# Pre-implementation brief template

Short, measurable, confirmable. Save as `docs/design/<page>/brief.md`, show it, wait for "go".

```md
## Page Understanding        purpose, hierarchy, what must feel closest to the source
## Fidelity Target           structural | balanced | high-fidelity; viewport; page width
## Source Inputs             image paths (original + scaled), section crops, notes
## Section Breakdown         order -> role -> primary content vs decoration
## Input Mode                full-page / segmented; measurement availability; confidence limits
## Visual Anchors            structure/proportion/style/detail anchors; first-screen density
## Reuse Mapping             section/pattern -> existing component/shell/token (allowed|conditional|blocked)
## Media Role Decisions      background vs content image per visual; fallbacks
## Asset Fulfillment Plan    slot | strategy (existing/crop | css-svg | single-gen | atlas | formal-fallback)
                             | display size + pixel size | output path | blocking (before-code | before-final | accepted-fallback)
## Asset Compression Plan    role, preferred format, size risk, exemptions
## Normalized Measurements   source width -> page width scale; critical boxes only
## Layout Implementation Plan  per section: flex|grid|overlay; shell vs inner container; spacing rhythm
## Framework/Output Plan     vue|astro|nuxt; file locations; repo conventions to follow; data-section ids
## Accepted Deviations       allowed by product/project constraints
## Not Accepted Deviations   must be repaired, not explained away
## Known Ambiguities         unreadable text, asset status, ambiguous media role, section relations
## Verification and Repair Plan  sections to capture; layers scored; max rounds (3); priorities
```

Asset atlas manifest (only if generating several same-family bitmaps):
```json
{ "atlas_id": "category-atlas", "source_path": "docs/design/generated/category-atlas.png",
  "canvas": {"width":1536,"height":1024},
  "policy": {"production_must_reference_crops_only": true, "no_baked_text": true, "no_unrelated_roles": true},
  "crops": [{"id":"hand-tools","section":"categories","coords":{"x":0,"y":0,"width":384,"height":512},
             "output_path":"public/assets/categories/hand-tools.webp","aspect_ratio":"4:3","object_fit":"cover"}] }
```
Note: the bundled `crop-atlas.mjs` reads `atlases[].sourcePath` and `entries[].crop{x,y,width,height}, outputPath` - use that shape with the script; keep the schema above for the human brief.

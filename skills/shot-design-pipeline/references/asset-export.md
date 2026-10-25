# Asset export and handoff

## Code-native vs image
Code: navigation, headings, paragraphs, buttons, forms, plain cards, tables, ordinary linear icons, charts with data. Image: photography, illustration, 3D/glass-like hero art, textures, brand marks that CSS cannot reproduce. Logos/wordmarks only as the user's own marks. Social/community icons: vector-quality exact glyphs of the platform or the user's stylized set - not generic icons, not text labels.

## Reuse before regenerate
Inspect original and project assets and clean crops first; regenerate only when missing or poor quality. Do not redraw brand marks by default.

## Folder layout
```
asset-exports/<slug>-YYYYMMDD-HHMM/
  manifest.json        01-logos/  02-icons/  03-ui-elements/  04-backgrounds/  05-page-assets/
  06-ready/            renamed finals only (cleaned + verified)
  notes/               asset-plan.md  prompts.md  font-and-token-notes.md  builder-handoff.md  icon-inventory.md
```
Defaults when requested: logo primary/mark/wordmark, favicon, a small icon set (5 unless told otherwise), button/nav/card/input/CTA/footer components only if code cannot reproduce them. Priorities: P0 needed for first faithful build (logo, hero art, visible world icons, textures), P1 polish (gallery cards, hover variants), P2 optional alternates.

## Per-asset generation rules
One image per asset (no combined sheets). Prompt names: source style kit, the single asset, background policy, intended use, fidelity anchors (color family, stroke weight, radius, shadow, edge treatment). Logos/icons/UI pieces are isolated - no page background. Only true backgrounds are full-bleed. Keep stable aspect ratios and enough resolution for desktop and mobile. Match actual palette; do not "improve" or add overlays absent from the design.

## Cleanup and verification
Transparent preferred; otherwise flat neutral background. A baked checkerboard is **not** transparency. Remove flat backgrounds with a segmentation or key-colour tool you trust (key colour must not appear in the subject; white-on-light and hair/glow edges need a better method), shrink/contract edges only after sampling, then verify:
```bash
node scripts/check_alpha.mjs 02-icons/icon-01.png --require-transparency
```
Exit 2 = no usable alpha / baked checkerboard / fringe. Then view on a dark and a light background at final display size. Assets with `alpha_required: true` need `background_cleaned` and `alpha_verified` true before entering `06-ready/`.

## Manifest entry
```json
{ "id": "icon-03-search", "file": "02-icons/icon-03-search.png", "role": "icon", "source": "generated|user|crop|stock",
  "license_note": "...", "alpha_required": true, "background_cleaned": true, "alpha_verified": true,
  "background_policy": "transparent", "size": [256,256], "accessibility": "decorative|alt:...|hidden-text:...",
  "used_in": ["nav", "hero"] }
```
Decorative image-text (text baked in an asset) needs equivalent hidden/accessible text in the page. Compression: webp for photos/illustrations within the budgets in `../shot-analyze/references/asset-and-font-policy.md`; svg for icons when a vector exists.

## Builder rules
Read manifest and tokens first; prefer `06-ready`; copy (never move) assets into the site; local files only; do not crop whole-page mockups into sections as production assets unless the manifest marks them so; no gray placeholder boxes; missing asset -> generate only that asset or state the gap; fonts: exact only if licensed/present, else documented fallback and say so.

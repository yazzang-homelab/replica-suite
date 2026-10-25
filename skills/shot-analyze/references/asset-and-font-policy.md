# Asset and font policy

## Asset source order (decide per slot, not "crop everything")
1. User-supplied or project-existing file - use as is.
2. Real logo/icon -> project file; otherwise simple marks as inline SVG, standard icons from the project's icon library (lucide default).
3. Specific unique content shown in the target (a product card, a chart, an album cover) -> crop from the source **only if the region is sharp at its display size** (`scripts/crop.mjs`, rect tolerance is fine).
4. Generic photography -> a sharp stock/project image beats a fuzzy crop; match subject, crop, tone.
5. CSS/SVG when reproducible (gradients, simple shapes, dividers, waves).
6. Generated image (image-gen tool) for hero/product/people/illustration slots when the user allows it.
7. Last resort: labelled placeholder (`<!-- asset: hero photo, 1200x800 -->`), never a gray box with no note.

Quality gate: never ship a blurry upscaled crop; prefer 2x sources and keep crops near native size. Do not bake text, buttons, navigation or form labels into images - they stay code-native. Mark slots needing replacement assets as `needs-own-asset`.

## Background vs content image
- **background**: fills a hero/card/section, text overlays it, cover-cropped, little standalone meaning -> CSS background layers.
- **content image**: product, avatar, logo, chart, gallery item, article media; carries meaning -> `<img>`/`<picture>`/Image with `alt`.
- Ambiguous and information-bearing? Ask once; otherwise default to content image.

## Roles and budgets
| Role | Preferred format | Soft / hard size |
|---|---|---|
| critical content image | webp | 400KB / 800KB |
| decorative bitmap | webp | 250KB / 500KB |
| ui/icon-like asset | svg | 80KB / 150KB |
| temporary crop fallback | webp, flagged | 250KB / 500KB |
Display scale no more than ~3x of the CSS box. Mark crop fallbacks so they are easy to replace and never described as originals.

## Atlas generation (only if generating images)
Several same-family small/medium bitmaps (2-8 thumbnails, avatars, card visuals) may be generated on one sheet, then **cropped into independent files**; code references the cropped files, never the sheet with `background-position`. Do not atlas: hero visuals, CTA banners with text safe areas, logos/icons, portraits needing individual QC, images with meaningful generated text.

## Fonts
- Inventory each distinct font by role (brand/display/heading/body/UI/numeric/CJK) with traits if the name is unknown.
- Per role choose one: exact self-hosted, close open substitute self-hosted, project/system stack, asset-rendered (logo wordmark as SVG), CSS-feature (tabular-nums, tracking), or accepted deviation.
- Consolidate: 5-8 design fonts do not become 5-8 webfonts; keep at most one critical display face, one body/UI stack.
- Production: self-host woff2, only used weights, `font-display: swap`, fallback stack incl. CJK (`'Pretendard','Noto Sans KR',system-ui,sans-serif`). Prototypes may use a CDN link.
- Never take fonts from unofficial mirrors.

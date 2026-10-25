# UnoCSS output rules (Vue / Astro)

## Detect first
- `unocss` / `@unocss/vite` / `@unocss/nuxt` / `@unocss/astro` in `package.json`; config in `uno.config.ts`.
- Preset names changed across versions (`presetUno` -> `presetWind3` / `presetWind4`): use whatever the installed version and config already use; never add a second utility preset.
- If UnoCSS is absent and the user asked for it: install the integration for the resolved framework (Vite plugin for Vue, `@unocss/astro` for Astro, `@unocss/nuxt` for Nuxt) and create `uno.config.ts` - only after the brief says so.

## Tokens in `uno.config.ts`
```ts
import { defineConfig, presetIcons, presetWind3 } from 'unocss'
export default defineConfig({
  presets: [presetWind3(), presetIcons({ scale: 1.1 })],
  theme: {
    colors: { bg: '#0B1220', surface: '#111A2E', ink: '#E5E7EB', muted: '#94A3B8', brand: '#3B82F6' },
    fontFamily: { sans: "Inter, Pretendard, 'Noto Sans KR', system-ui, sans-serif" },
    borderRadius: { card: '12px' },
  },
  shortcuts: { 'btn-primary': 'inline-flex items-center rounded-card bg-brand px-5 h-11 text-white' },
})
```
Reuse existing theme keys before adding new ones; shortcuts only for 3+ identical repeats.

## General rules
- UnoCSS utilities first; a minimal scoped `<style>` only when utilities cannot express it (complex gradients, masks).
- One page file by default; `data-section` on every major section (`data-media-role="background|content"` and `data-diff-target` are optional debug aids).
- No remote asset URLs; images and SVGs local; raw inline SVG markup in page code is avoided (reference local `.svg`, or an icon preset class like `i-lucide-search`).
- Content images have `alt`; backgrounds carry no essential information alone.
- Abstraction: inline structure by default; factor only with 3+ identical repeats; no routing/API/state beyond explicit interactions.
- Per section pick one layout system (`flex`, `grid`, or overlay/absolute) and a shell (full-bleed band) vs inner container (max-width) split.

## Vue
Match repo style (`.vue` SFC, `<script setup>` only if needed), local minimal reactivity, existing UI library for functional controls.

## Astro
Static sections stay static (`.astro`); add a client island only for explicit interactions; no framework runtime without need.

## Width and scale
`scale = pageWidth / imageWidth`; analyze with scaled values only. For mobile H5 evidence emulate the real device (e.g. 390x844, DPR 2, mobile + touch) and print `innerWidth` and `scrollWidth`; a plain `--window-size` can disagree with the CSS viewport.

## Icons
Resolve icons from the project's icon setup (Iconify via `presetIcons`) first; record anatomy (bare vs tiled, box size vs glyph size, position relative to text/value). `font-size` is not glyph size: different viewBoxes need a recorded compensation. Bare icon in design = bare icon in code; do not add colored tiles.

## Shape tokens
Component-specific radius/height/padding for chips, tabs, pills, cards, hero panels - a global radius is not enough. Filter/tab labels do not wrap unless the source wraps them (nowrap, horizontal scroll or resizing first).

# Stack setup (skip when inside an existing project)

## Single-file HTML, vanilla tokens
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Replica</title>
  <style>
    :root{--bg:#0b1220;--surface:#111a2e;--ink:#e5e7eb;--muted:#94a3b8;--line:rgba(255,255,255,.09);--brand:#3b82f6;
          --radius:12px;--space:8px;--font:'Inter','Pretendard','Noto Sans KR',system-ui,sans-serif}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--font)}
    .container{width:min(1200px,92vw);margin-inline:auto}
    h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.1;letter-spacing:-.02em}
  </style>
</head><body>...</body></html>
```

## Single-file HTML with Tailwind v4 (prototype only)
```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
  @theme { --color-brand:#3b82f6; --font-sans:"Inter","Pretendard",ui-sans-serif,system-ui,sans-serif; }
</style>
```
v4 rules: config lives in CSS; use `@import "tailwindcss"` (build) not `@tailwind base/...`; no `tailwind.config.js`; custom tokens become utilities (`bg-brand`).

## React + TypeScript + Tailwind v4 (Vite)
```bash
npm create vite@latest app -- --template react-ts && cd app
npm i tailwindcss @tailwindcss/vite lucide-react
```
`vite.config.ts`: `plugins: [react(), tailwindcss()]`. `src/index.css`: `@import "tailwindcss"; @theme { --color-brand:#3b82f6; }`.
React 19: function components, typed props; no `propTypes`; `ref` is a normal prop. CRA is deprecated - use Vite.

## Next.js App Router
```bash
npx create-next-app@latest app --typescript --tailwind --app --eslint --yes
```
Pages in `app/`, Server Components by default; add `"use client"` only to files with state/effects/handlers; `next/image` with explicit width/height; tokens in `app/globals.css` `@theme`.

## Vue 3
```bash
npm create vite@latest app -- --template vue-ts && cd app && npm i tailwindcss @tailwindcss/vite
```
Same Tailwind plugin + CSS import. `<script setup lang="ts">`, `defineProps<{...}>()`, keep state local.

## Svelte
```bash
npm create vite@latest app -- --template svelte-ts   # or: npx sv create app (SvelteKit)
```
Tailwind v4 via the Vite plugin as above. Svelte 5 runes (`$props()`, `$state()`) when the project is on 5; otherwise match the existing syntax. Scoped `<style>` for component CSS, tokens as CSS variables in a global stylesheet.

## Component shape (React example)
```tsx
type PlanCardProps = { name: string; price: string; features: string[]; highlighted?: boolean };
export function PlanCard({ name, price, features, highlighted = false }: PlanCardProps) {
  return (
    <article className={`rounded-xl bg-surface p-6 ${highlighted ? 'ring-2 ring-brand' : ''}`}>
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="mt-2 text-4xl font-bold">{price}</p>
      <ul className="mt-6 space-y-2">{features.map((f) => <li key={f}>{f}</li>)}</ul>
    </article>
  );
}
```
Equivalent Vue/Svelte: a component taking the same props, `v-for`/`{#each}` over data.

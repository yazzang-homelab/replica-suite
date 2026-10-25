# Mirror QA and publish checklist

## Asset-loading triage
- Server log 404s first. Root-relative `/media/x.png` needs the output dir as web root.
- `url(...)` inside *external* CSS is missed by HTML scanning: mirror nested CSS dependencies, including `@font-face` sources.
- Manifest icons are relative to the manifest: fetch them manually if absent.
- Query strings may stay in HTML while local files drop them; `http.server` ignores the query.
- Wrong/blank font: check `@font-face` URL, MIME type served, and SRI attributes (remove `integrity`/`crossorigin` on rewritten tags).
- Blank video: serve over HTTP not `file://`; verify MP4 path and autoplay policy (muted + playsinline).
- Scroll animation starts wrong: wait for `window.load`; ensure large images are local and loaded.
- First-frame difference with autoplay video: compare layout/crop/framing, not the exact frame (pause + `currentTime=3` only for exact comparisons).
- Mobile width drift: same viewport width and DPR for both screenshots.

## Comparison list (same viewport, original vs local, desktop + mobile)
logo position/size/fill, CTA shape and shadow, hero line breaks and rhythm, media crop and phone-frame inset, gradient/background, section transitions and sticky/clip-path behaviour, scrolled state, mobile crop/overflow, FAQ open/closed, menus, footer layout.

## After rebrand
- Old-brand scan returns zero hits in text and file names; no original CDN hosts, tracking ids, or source maps remain.
- Layout stable with new copy lengths (re-shoot all sections); contrast of the new palette checked.
- Links/forms point at the user's endpoints; legal pages and cookie text belong to the user.
- Testimonials, metrics, customer logos and press quotes are the user's own or removed - never leave the original's.

## Publish checklist
- `.web-clone/` and raw `reference/` dirs excluded (git-ignored).
- Replaceable assets reviewed; commercial fonts replaced or git-ignored when rebranding.
- Deploy only on explicit user instruction.

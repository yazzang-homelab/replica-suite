# Component spec template

File: `.web-clone/research/components/<name>.spec.md`. One per section or sub-component. A builder receives this file's text *inline* in its prompt, so it must be self-contained (no "see tokens.json").

```markdown
# <ComponentName> spec
## Overview
- Target file: src/components/<ComponentName>.tsx
- Reference crops: .web-clone/source/shots/sections/<NN>-<slug>-{1440,768,390}.png
- Interaction model: static | scroll-driven | click-driven | hover-driven | time-driven | mixed
- Embed? (yes -> original script URL, do not rebuild) 

## DOM structure
Hierarchy in 5-15 lines: what contains what, semantic tags, DOM mount strategy
(e.g. "all 6 carousel slides mounted, 5 hidden by opacity").

## Computed styles (exact)
### Container   display / padding / maxWidth / gap / background / border / radius / shadow
### <Child>     fontFamily / fontSize / fontWeight / lineHeight / letterSpacing / color / textAlign ...
### Card (first card) + ::before / ::after (content, background, mask, inset, animation)

## States and behaviours
### <name>  e.g. "header collapses on scroll"
- Trigger: scrollY > 64 | IO rootMargin "-30% 0px" | click .tab | hover
- State A: ...   State B: ...   (values from diff_states.py)
- Transition: all 300ms cubic-bezier(.4,0,.2,1) | JS tween | animation-timeline: view()
- Implementation approach: CSS transition + scroll listener | IO | CSS keyframes copied
- Reverse direction / hysteresis: ...

## Per-state content (tabs, carousels)
Each state: title, copy, items[], images.

## Assets
Local paths under public/, inline icon component names, video posters, fonts used.

## Text (verbatim)
All strings incl. alt/aria/placeholder. (Rebrand pass may swap them later.)

## Responsive
1440: ... | 768: ... | 390: ... | breakpoint(s): ~Npx
```

## Builder-ready checklist
- [ ] every value computed, none estimated
- [ ] interaction model stated
- [ ] every state captured with trigger + transition
- [ ] hover before/after + timing
- [ ] layered images and overlays enumerated
- [ ] responsive behaviour for desktop and mobile
- [ ] text verbatim, assets have local paths
- [ ] spec <= ~150 lines, else split

# Builder brief template

Send one brief per builder. Paste spec contents inline; builders must need no other document.

```
ROLE: You build exactly one React component for a website clone. Do not edit any other file.
TARGET FILE(S): src/components/<Name>.tsx  (+ src/components/<Name>/* only if listed)
STACK: <Next.js App Router | Vite+React>, Tailwind v4, shadcn primitives available, cn() in src/lib/utils
SHARED IMPORTS ALLOWED: @/components/icons (names: ...), tokens already in globals.css (names: ...)
REFERENCE IMAGES: <paths to crops at 1440 / 768 / 390>   (open them before coding)

=== SPEC (verbatim from components/<name>.spec.md) ===
<entire spec text>
=== END SPEC ===

REQUIREMENTS
1. Use the spec's computed values exactly (px, rgb, easing). No guessing, no "close enough".
2. Real text and assets only; assets are at public/... . No hotlinks, no placeholder lorem, no generic gradients in place of real images.
3. Implement every state and behaviour in the spec with the stated trigger and transition. Use plain scroll listeners, not requestAnimationFrame throttling.
4. Tag interactive controls: data-clone-interaction="<id>" and the controlled surface data-clone-controlled="<id>"; wrap the root with data-clone-section="<name>".
5. Responsive at 1440 / 768 / 390 as specified.
6. Do not copy source class names, comments, or analytics. Write semantic markup yourself.
7. Verify: `npx tsc --noEmit` (and lint if configured) must pass. Do not run the full build in a shared tree.

RETURN
- files changed
- spec items implemented / not implemented (with reason)
- anything you needed that was missing from the spec (so the foreman can extract it)
```

## Foreman checks on return
Diff touches only the target files; no new dependency unless approved; tsc passes after merge; section tag present; each behaviour in the spec has code; no hotlinked URLs (`grep -rE 'https?://' src/components/<Name>*`).

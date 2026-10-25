# Design system for a clone

## 1. Measure the original's system (numbers only)
From the public rendered page / screenshots / the user's own session record:
colour roles (canvas, surface, ink, ink-soft, accent, on-accent, border), type scale and body size, spacing base (4/8px?), corner radii, shadow character, motion durations, content widths, breakpoints. Mark pixel-estimated values `~`. Record the original's brand colours and typeface in `appclone/design/avoid.json` - the later sweep uses it.

## 2. Keep / Change / Add
| Keep (system) | Change (identity) | Add (taste) |
| --- | --- | --- |
| spacing rhythm, type step count, density, widths, interaction patterns | palette and brand hue, typefaces, icons, imagery, corner/shadow character, copy, name | one signature detail, designed empty/loading/error states, purposeful motion, research fixes visible on screen |
If the user has a brand or the host app has a design doc, it replaces the Change column entirely.

## 3. Three directions
Describe in words before any mockup: idea (tied to the research opening), palette family + one accent, display + text typeface, shape (radius/shadow), density, motion, signature detail. They must differ in kind, not tint. Recommend one; the user picks. Avoid AI defaults: violet gradient, pure black, one typeface at three sizes, three equal cards with a highlighted middle price, centered gradient hero.

## 4. Tokens
`tokens.json` (colors by role incl. dark if needed, typography roles, radius scale, spacing scale, elevation, motion) -> generated `tokens.css` / Tailwind theme. Components reference tokens (`{colors.accent}`), never raw values.

Lint before moving on: every colour parses; contrast AA; accent in a different hue family from the original's brand; not the original's licensed typeface (use an open font: Inter, Geist, IBM Plex, Manrope, Source Serif, Fraunces); two typefaces max; body 15-18px; one corner scale; one spacing base.

## 5. Component spec block
```
Button
  variants primary, secondary, ghost, danger   sizes sm 32 / md 40 / lg 48
  states default hover active focus-visible disabled loading
  tokens bg accent, text on-accent, radius md   a11y real <button>, visible focus
  used on S02, S07
```
Build primitives first on a `/design` preview route and look at it at 390 and 1440 wide before building screens.

## Taste floor
Specific fresh copy in the user's voice; reasoned type pairing; real states; keyboard reachable; one accent. Look at every screen screenshot before calling it done.

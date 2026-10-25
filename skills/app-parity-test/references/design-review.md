# Design review (the critic pass)

Refuse, do not coach: "pretty good" fails until it is good. Judge the rendered screenshot, not code intent. Read the design tokens and the screen's purpose/primary action first; view at 1440 then 390.

## Hard rejects (any one fails the screen)
broken layout (overlap, cut-off text, horizontal scroll at 390); unreadable contrast or invisible focus ring; placeholder content (lorem ipsum, "John Doe", empty frames, broken images); invented proof (user counts, logos, testimonials with no source); the original's identity (logo, brand colour with its layout, illustrations, words, icons); the generic AI page (3+ tells: centred gradient hero, three equal icon cards, emoji icons, one typeface at three sizes, violet glow); a missing empty/error/loading state; no visible focus.

## Scores 1-5
hierarchy (one clear first read, one primary action), rhythm (one spacing scale, tight groups), type (<=2 faces, real scale), colour (one accent with a job), fit (density suits task, real phone layout at 390), craft (alignment, consistent corners/icons, states designed), character (recognisable without logo, not the original recoloured).

Pass = no hard rejects, no score under 3, total >= 28/35.

## Verdict record (`appclone/verify/critic.json`)
```json
{"screen":"S07","viewport":390,"hardRejects":[],"scores":{"hierarchy":4,"rhythm":4,"type":4,"color":4,"fit":4,"craft":4,"character":4},"total":28,"pass":true,"fixes":[{"issue":"...","fix":"...","where":"slot grid"}]}
```
Fixes name issue, change and place, ordered by impact; three precise fixes beat ten vague ones.

# Auto-fix loop (diff -> triage -> fix -> re-measure)

Run per section, not once at the end. Cap at 8 rounds per section; if the worst band does not
shrink for 2 consecutive rounds, stop and escalate with evidence instead of guessing.

```
round N:
  1. capture replica (same flags)            -> replica/
  2. pixel_diff.py                            -> diff/report.json, overlays
  3. triage: pick the single worst failing record (size > structure > color > text > AA noise)
  4. localise: worstBands[0].yStart..yEnd -> map to section via data-clone-idx / section y-offsets
  5. measure BOTH pages for that region (getBoundingClientRect + computed styles), diff the numbers
  6. change ONE cause, rebuild/reload, goto 1
log each round in .qa/rounds.md: record, ratio before/after, cause, fix
```

## Triage order
1. Page height / screenshot size mismatch.
2. Missing/extra section or layer; wrong asset or crop; broken image.
3. Layout geometry: container max-width, grid columns, gap, padding, sticky offset.
4. Typography: wrong family/weight file, size, line-height, letter-spacing, wrapping.
5. Colour/shadow/border/gradient values.
6. Motion state and media frames.
7. Anti-aliasing residue (accept if confined to glyph edges and fonts verified identical).

## Cause -> check -> fix
| Symptom | Measure | Typical fix |
|---|---|---|
| Whole page shifts down after one band | element heights above the band | line-height, image `aspect-ratio`/dimensions, margin collapse, `box-sizing` |
| Text wraps differently | computed font-family actually used, `font-weight`, `letter-spacing`, container width | load exact font file with correct weight (variable vs static); fix width before touching text |
| Right edge differs only on 1920 | `max-width` and centering of wrapper | restore cap; check `vw` vs `%` units |
| Mobile differs, desktop clean | the `@media` list on reference | copy real breakpoint, not an invented one; verify hidden duplicate desktop/mobile blocks |
| Image slightly off | `object-fit`, `object-position`, rendered vs natural size, srcset pick | use `currentSrc` asset and observed crop |
| Colour off by a few levels | computed colour vs declared; colour-space/opacity layering | use the exact rgba/oklch from reference, check parent opacity |
| Region fine live, red in diff | animation not settled / video frame | freeze both sides or mask and verify separately |
| Content appears only after scroll on reference | reveal state | capture post-prime on both sides; confirm replica reveals too |
| Replica-only 404 | local asset path / base URL | fix path; never hide behind cache |

## Guardrails
- One change per round; revert changes that do not reduce the targeted band.
- Never edit the reference capture, thresholds, or masks to make a failure disappear.
- Never loosen `--threshold`/`--max-ratio` mid-loop without recording why and user consent.
- Fix the largest structural difference first; AA noise last.
- Stop condition = all records pass, or a documented, user-accepted residual list.

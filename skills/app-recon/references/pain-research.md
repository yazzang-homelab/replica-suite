# Pain research: why would anyone switch?

A straight copy has no reason to exist. Find the reason in users' own public words before building. Skip for "migrate" mode (user's own site).

## 1. Collect (aim 100+ rows, 3+ sources, newest first)
Store in `appclone/research/reviews.csv`: `id,source,url,date,rating,text` — text copied exactly, **a row without a link is dropped**.

| source | note |
| --- | --- |
| App Store / Play listing reviews | public feeds or read in browser; include 3-4 star ("love it, but...") |
| Hacker News / Reddit threads | search "<name> alternative", "switched from <name>", "<name> sucks" |
| G2, Capterra, Trustpilot | read by hand at human pace, never scrape |
| feature-request board / roadmap | public votes |
| changelog | do not "fix" what is already fixed |
| public pricing page | all plans, URL, date read |

## 2. Theme and verify
Group rows into themes with a kind: **hate** (complaint about what it does), **missing** (named absent feature), **unsolved** (ignored job or user group), **love** (clone must keep this).
Each theme: id, label, row ids, quotes. Quotes must be exact substrings of their row. Re-check every quote against the CSV before it appears in any report. Weight low ratings and recent rows higher (rows older than ~18 months count half). Mark a theme **thin** if <3 reviews or one source. List 1-2 star rows no theme covered and read them by hand.

## 3. Verdict (`appclone/research/verdict.md`)
- **Decision**: go / no-go / go-rescoped, 2-3 sentences of evidence.
- **The opening**: up to three angles "For <who> who <hate in plain words>, the clone <does this instead>", each with evidence; recommend one.
- **Must keep** (from love themes). **Fixes to build first**: 3-8, chosen by evidence x cheapness; each becomes a `features.csv` row with `original=no`.
- **Cannot clone**, **risks** (API limits, provider reviews like OAuth verification, account terms).
Ask the user for the decision and the angle; this is the main checkpoint.

## Never
Invented reviews, quotes, ratings, counts; reviewers' words as testimonials on the clone's landing page; fake reviews for either product. If a source is unreachable, say so; if there are 14 rows, report 14.

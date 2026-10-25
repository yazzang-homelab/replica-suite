---
name: app-brand-deploy
description: Makes a clone legally and visibly its own and ships it - name candidates with trademark/domain/store checks, new palette and logo brief, voice, a sweep that finds leftovers of the original, landing page, pricing, store listing lint, preflight checklist, production setup, DNS, monitoring and mobile release. Use for "브랜딩", "이름 짓기", "리브랜딩", "배포", "출시", "스토어 등록", "원본 흔적 검사", "rebrand the clone", "name my app", "make it mine", "deploy it", "ship it", "launch checklist", "app store listing", after app-parity-test says shippable.
---

# app-brand-deploy

Nothing launches under the original's identity, nothing launches as a straight copy, and nothing goes live without the user's explicit go for that step. Not legal advice: when money or a launch depends on it, tell the user to consult a lawyer in their jurisdiction.

## Authorization / clean-room gate
- Applies to clones of apps the user may analyse in the first place (see `app-recon`). For a user-owned site migration the brand is the user's own: skip naming, run the sweep only for third-party licence leftovers.
- The **user** buys domains, creates accounts, enters cards, pastes live keys, signs in to consoles, and says "go". You write exact records, env var names and commands.
- Default posture before a decision: private, `noindex`, not published. Moving towards public requires the user's explicit decision; present facts and risk boundaries, do not announce legal conclusions.
- Never invent reviews, ratings, user counts, logos or testimonials. Reviewers' words are research, not landing-page proof.

## Workflow
1. **Name** (skip in feature/migrate mode): read the opening in `appclone/research/verdict.md`; generate ~20 candidates (descriptive, compound, invented, metaphor, verb); cut to 5: not confusingly similar to the original in sound/look/meaning (no puns, no "-ly" twin), short, spellable, no bad meaning in major languages. Run and record each check with date and result ([references/brand-checklist.md](references/brand-checklist.md)): domains, App Store/Play search, handles, USPTO (classes 9, 42), EUIPO/TMview, WIPO, web search. Never write "available" for a check nobody ran. User picks.
2. **Identity**: palette from `app-spec` tokens (different hue family from the original, AA contrast), logo brief (idea, mark type, works at 16px and 1024px, no transparency for iOS icon, must not resemble the original's mark), voice (three words with "not X" qualifiers, five do/don't pairs, rewrite the ~10 most-seen strings fresh).
3. **Brand files**: keep identity and research in `appclone/brand.json`. Write the scanner's separate `appclone/brand-scan.json` as `{"avoid":["Original","Its Company"],"domains":["original.com"],"colors":["#006bff"]}`; only these three keys are accepted.
4. **Sweep** (blocks launch until clean): `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/brand.py" scan . --config appclone/brand-scan.json`. Finds names (also inside identifiers), domains, colours and file names; exit 1 = leftovers, exit 2 = invalid input. Evidence folders `appclone/` and `replica/` are excluded unless `--include-evidence` is set. Also inspect favicon, page titles, email templates, OG image, app icon, store screenshots and runtime requests. Document deliberately retained compatibility mentions; they remain visible scanner hits, not silently allowed exceptions.
5. **Landing page** from the opening: hero (what, for whom, one button, real screenshot), the top two problems in paraphrase, three-step how-it-works, features led by the fixes, pricing, FAQ, last CTA. Proof is real or absent.
6. **Pricing**: original's public plans and 2-3 alternatives with URL + date read; fix billing complaints in the product (one-click cancel, clear renewal emails); at most three plans. The user creates Stripe products.
7. **Store listing** if shipping to stores ([references/brand-checklist.md](references/brand-checklist.md)): check character limits (they change; verify in the consoles), no original name anywhere, no ranking/price claims in short fields; Apple 4.1 rejects copycats so show fixes and the new brand first; privacy labels/data-safety form, privacy policy and support URLs, age rating, review notes with a demo account.
8. **Preflight** ([references/preflight.md](references/preflight.md)) and write `appclone/deploy.md`; show results and ask for the go.
9. **Ship** after the go: separate production database with backups; env vars on the host; Stripe live (recreated products, webhook + secret, one real purchase refunded); OAuth redirects at every provider; email domain verified (SPF/DKIM/DMARC); host connected to `main` with preview URLs; DNS records written for the user; canonical host + HTTPS; error tracking, uptime checks on home and core API, alerts; walk the core flow live on desktop and phone. Mobile: `eas build`/`eas submit` or Xcode/Gradle to TestFlight / Play internal testing first.

## Verification gates (all must pass; a skipped check is a skip, not a pass)
sweep exit 0 · e2e green · no open S1/S2 · all must-have features done and parity verdict >= shippable · production build passes · privacy/terms live and listing every processor · account deletion works · favicon/titles/OG/emails/icon are the user's · naming checks recorded with dates.

## Outputs
```
appclone/brand.md, brand.json     name + checks, palette, logo brief, voice
appclone/brand-scan.json          avoid/domains/colors scanner configuration
appclone/launch/                  landing.md, pricing.md, listing.json
appclone/deploy.md                filled preflight, live URL, DNS records, week-one watch list
```

## References
- [brand-checklist.md](references/brand-checklist.md) — name checks, logo brief, voice, listing limits
- [preflight.md](references/preflight.md) — deploy checklist template
- shared script: `${CLAUDE_PLUGIN_ROOT}/scripts/brand.py` (`scan` and explicit `replace --apply`; stdlib Python)

## Sources
Derived from: Jakeschincariol/replica-skill (brand, launch, deploy; MIT scanner logic consolidated in the shared brand CLI), thenavidm/remaster (launch stage, sweep/copy/listing checks, checkpoints), boyang-hu/website-rebuild-skill (private+noindex safe default, user decides on publication), Birkenpapier/ai-app-cloner (mobile/Expo release path).

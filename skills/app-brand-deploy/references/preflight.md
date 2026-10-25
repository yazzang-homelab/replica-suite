# Deploy checklist (`appclone/deploy.md`)

Date: ____  Commit: ____  User's go: yes / not yet

## Preflight (all must pass; any failure stops the deploy; say which and why)
- [ ] e2e suite green (n/n)           - [ ] no open S1/S2 bugs
- [ ] parity: must-haves n/n, feature score n, verdict >= shippable
- [ ] `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/brand.py" scan . --config appclone/brand-scan.json` exit 0
- [ ] store listing checks pass (if shipping to stores)
- [ ] production build passes         - [ ] dependency audit reviewed
- [ ] privacy policy + terms live, every processor listed; cookie banner if non-essential cookies in EU/UK
- [ ] account deletion works
- [ ] favicon, titles, OG image, emails, app icon are the user's

## Production
- [ ] separate production DB, backups on, migrations run by the deploy
- [ ] env vars on host match `.env.example` (live keys only here, pasted by the user)
- [ ] Stripe live: products/prices recreated, webhook endpoint + secret, one real purchase refunded
- [ ] OAuth redirect URIs/origins include prod domain; sensitive-scope verification approved
- [ ] email sending domain verified

## Domain (user buys it; you write the records)
| type | name | value |
| A | @ | host apex IP |
| CNAME | www | host target |
| TXT | @ | host verification value |
Email: SPF (TXT), DKIM (CNAME/TXT), DMARC `v=DMARC1; p=none; rua=mailto:...` then tighten to quarantine after clean reports. One canonical host, other redirects; HTTPS valid.

## Watch
- [ ] error tracking  - [ ] uptime checks (home + core API)  - [ ] logs kept  - [ ] analytics  - [ ] alert to user
- [ ] core flow done on the live site, desktop and phone
- [ ] mobile: TestFlight / Play internal first, then review with the listing
Record: live URL, DNS records set, what to watch in week one.

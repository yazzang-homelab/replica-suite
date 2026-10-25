# Architecture template

## Default stack (swap freely; record the reason)
| layer | default | swap for |
| --- | --- | --- |
| web | Next.js + TypeScript | SvelteKit, Remix, Rails |
| mobile | Expo / React Native (+ Expo Router, NativeWind) | SwiftUI, Kotlin |
| db | Postgres (Supabase/Neon) | SQLite/Turso for small apps |
| ORM | Drizzle or Prisma | raw SQL |
| auth | Auth.js or Supabase Auth | Clerk |
| payments | Stripe Checkout + Billing + Customer Portal | Paddle, Lemon Squeezy |
| email | Resend / Postmark | SES |
| jobs | host cron, Inngest, Trigger.dev | worker process |
| files | R2 / Supabase Storage / S3 | - |
| hosting | Vercel | Netlify, Fly, Render, Cloudflare |

## architecture.md skeleton
```markdown
# Architecture: <clone name>
Stack (one line + reason per choice)
## Schema (link schema.sql) - table list, ownership column, access-rule strategy
## Routes / server actions
| method path | purpose | caller | input | output | flow |
## Webhooks in/out, scheduled jobs (schedule, retry policy)
## Parts that bite (time zones, idempotency, races, limits, offline, privacy)
## Build order
M1 vertical slice: screens S.., tables .., routes ..
M2 must-haves by area ...   M3 research fixes ...   M4 should/could ...
## Decision log (choice | alternatives | why | revisit when)
```

## Schema checklist
- `id uuid pk default gen_random_uuid()`, timestamps, owner column.
- FK `on delete` chosen deliberately; index every FK and every filter/sort column.
- status fields as enum/check; UTC `timestamptz`; money = integer + currency.
- uniqueness / exclusion constraints for business invariants.
- every relation inferred from screenshots is a `hint` until confirmed (plain nullable column, not a hard FK).
- seed script with fake people only; migrations checked in and applied by script.

## Backend rules to carry into build
- Secrets only in env vars; `.env.example` lists names without values; the user creates accounts and keys.
- Validate input server-side on every route; authorize every read/write; rate-limit sign-in, sign-up, and anything that sends email/SMS.
- Webhooks verify signatures and are idempotent (store event id). Subscription state lives in your DB, written by webhooks.
- Account deletion truly deletes. Uploads have size/type limits.

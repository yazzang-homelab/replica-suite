# Build rules

## Data-operation triage
Classify every action in each spec.
- **On-device** (implement for real, persisted): local CRUD, drafts, toggles, theme/notification preferences, sort/layout, selected filters, reordering, selection mode. Use a small repository seam (e.g. a `useCollection(key, seed)` hook over AsyncStorage/localStorage/SQLite) so the store can later be swapped for a real backend without touching screens. A settings screen should have fewer rows that work rather than many dead rows.
- **Backend** (cannot be faithfully cloned from the outside): server auth, sync, realtime, remote search, payments, push. Either mock with typed stubs + `cut` note, or implement with official public APIs and the user's own keys.
- A shell that cannot *do* anything is not a clone. Each owned collection needs at least: create, edit-existing, delete, persist-across-reload flows.

## Backend when real
Migrations in repo; access rules on every table tested with a second user; seed script with fake data; Stripe in test mode until launch (signature-verified idempotent webhooks, state in own DB, one-click cancel); integrations request the fewest scopes (provider review such as Google OAuth verification can take weeks: start early); reminders/sync as scheduled jobs with retries and a failure log; times in UTC, rendered in the viewer's zone.

## Security every time
Secrets in env only (never in client bundles); server-side validation; authorization on each read/write; rate limits on auth and message-sending endpoints; upload limits; no user data in URLs/logs; dependency audit before launch.

## Effect-heavy pages (canvas/WebGL/scroll-scrubbed video)
Rebuild the **effect**, never the **scene**: own models, textures, shaders, footage. Lightest tool first (CSS/scroll timeline, then small canvas, then 3D library). Provide a still fallback for reduced motion/low-power devices. Compare behaviour (what reveals, pins, responds) rather than pixels; mask the canvas region in pixel diffs.

## Feature mode (one feature into an existing app)
Read the host app first: routes, components, data layer, auth, conventions, design doc. Use the host's components/tokens, match style, change nothing else, add tests to the host suite, and keep its existing tests green.

## Migrate mode (user owns the source site)
Copying content is the point. Keep every URL (301 where a path must change), carry titles, descriptions, canonicals, OG/structured data, forms, embeds, analytics, redirects. Verify each old URL ends in 200 within one redirect and pixel parity per page (~95%). Check font/image licences still cover the new host.

## Honest recovery limits (screenshot-only inputs)
Rasters cannot yield vector icons, brand illustrations or photos; re-create with an open icon set or own art and state this in `build-log.md`. Estimated spacing/colour values stay marked as estimates until the diff loop confirms them.

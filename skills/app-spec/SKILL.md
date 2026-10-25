---
name: app-spec
description: Turns an app-recon map into a buildable specification - stack choice, database schema, API/route list, design tokens (measured system, new identity), component specs and a thin-slice build order. Use for "아키텍처 설계", "스택 선정", "스키마 설계", "디자인 토큰", "기능 매트릭스 확정", "plan the clone", "design the database", "write the schema", "what stack for my version of X", "design system from screenshots", after app-recon.
---

# app-spec

Reads `appclone/recon.md` and `appclone/features.csv`; writes the spec that `app-build` implements. If there is no recon map, stop and run `app-recon` first: planning from memory of what an app does misses half of it.

## Clean-room gate
- Spec from behaviour, measurements and public API docs only. Never from the original's source, bundle, decompiled binary or private endpoints. (Binary-derived facts must come through `app-internals` with its authorization gate, and enter the spec as cited evidence.)
- Keep the **system** (spacing base, type steps, density, layout widths, interaction patterns); change the **identity** (palette/brand hue, typeface, icons, imagery, copy, name). Signature colour plus signature layout is trade dress: change palette, type and signature details together.
- The clone does not need the original's architecture; it needs the original's features.

## Workflow
1. **Honour the user's stack** if they have one; otherwise pick boring managed defaults and justify each in one line ([references/architecture-template.md](references/architecture-template.md)). One database, no microservices.
2. **Schema.** Convert the inferred data model to real DDL: uuid ids, `created_at/updated_at`, owner column on user-owned rows, explicit `on delete`, indexes on FKs and filter/sort columns, check/enum for status, `timestamptz` in UTC, money as integer minor units + currency, access rules (row-level security or one authz check per query; say which). Encode hard constraints from recon (e.g. no double booking) in the database, not the UI. Mark every guessed column.
3. **API/routes**: one table per flow: `method path | purpose | caller | input | output | flow`. Plus inbound/outbound webhooks and scheduled jobs. Only official public APIs with the user's own keys.
4. **Parts that bite**: time zones/DST, idempotency (webhooks arrive twice), races, rate limits, file limits, search, realtime, offline, email deliverability, multi-tenancy, deletion/privacy law. One line each where relevant.
5. **Design system** ([references/design-system.md](references/design-system.md)): measure the original's system as numbers, choose Keep/Change/Add, write three genuinely different directions for the user to pick, then emit tokens (`appclone/design/tokens.json` + CSS/Tailwind theme) and component specs with every state (default, hover, focus-visible, disabled, loading, error, empty).
6. **Differentiators**: carry research fixes (`original=no` rows) into the matrix and architecture.
7. **Build order**: (1) vertical slice of the core loop, ugly but end-to-end; (2) must-haves by area; (3) research fixes; (4) should then could. Each milestone lists S-IDs, tables, routes.

## Verification gates
- Every `must` feature has an owner: a screen, a route or a table. Every S-ID in recon is assigned to a milestone.
- Schema applies cleanly to an empty database (run the migration) and a second-user query returns nothing from the first user's rows.
- Tokens lint: text/background contrast meets WCAG AA (4.5:1 body, 3:1 large and control edges); accent hue family differs from the original's brand hue; only one corner scale and one spacing base; components reference tokens that exist.
- No raw hex/pixel values are planned for components.

## Outputs
```
appclone/architecture.md   stack + why, routes, jobs, risks, build order
appclone/schema.sql        or first migration
appclone/design/           tokens.json, tokens.css, components.md, direction.md
appclone/features.csv      updated with fixes and skips
```
Summary: stack in one line, table/route counts, three riskiest parts, next skill (`app-build`).

## References
- [architecture-template.md](references/architecture-template.md) — default stack table, architecture.md skeleton, schema checklist
- [design-system.md](references/design-system.md) — measuring, keep/change/add, directions, tokens, taste floor

## Sources
Derived from: Jakeschincariol/replica-skill (architect, design, backend planning), thenavidm/remaster (design stage, taste floor, clean-room line), Birkenpapier/ai-app-cloner (data-model inference from UI, honest limits), boyang-hu/website-rebuild-skill (decision records for deliberate deviations).

# Catalog to app-spec

1. Read `appclone/features.csv`; map each `must` feature to the operations it needs. Operations with no feature owner are dropped or marked `compat`.
2. Routes table for `appclone/architecture.md`: `method path | purpose | caller (screen) | input | output | flow`. Prefer your own path naming when the clone owns both client and server; keep vendor paths only when interoperability with existing clients is a requirement stated by the user.
3. Schema: each response/request entity becomes a table or JSON column; derive types from DTO evidence; add owner column, timestamps, constraints (`app-spec` schema rules). Mark guessed columns.
4. Auth: choose boring standard auth (OIDC/session/JWT) unless interoperability is required; reuse the abstract auth contract only for flow shape (login, refresh, logout, anonymous).
5. Cross-cutting: pagination style, error envelope, rate limits, idempotency keys, file upload limits, realtime channel, push (own provider).
6. Hand `openapi.json` + `examples/` to `app-spec` (spec) and `app-parity-test` (contract tests). Cite catalog row ids in `appclone/sources.csv` so claims stay traceable.
7. Remaining unknowns become explicit spec questions for the user, not silent guesses.

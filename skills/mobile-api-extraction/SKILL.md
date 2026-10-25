---
name: mobile-api-extraction
description: Turn mobile-app evidence (decompiled Android/iOS output, JS bundles, authorized HAR/proxy captures) into a deduplicated endpoint catalog, then an OpenAPI 3 / API spec for a clean-room reimplementation, bridging to app-spec. Use for "앱 API 정리", "엔드포인트 카탈로그", "OpenAPI 스펙 작성", "모바일 앱 백엔드 재구현", "API 명세 역추출", "extract app endpoints", "build API spec from APK/IPA", "endpoint inventory to openapi", "document the app's backend", "HAR to spec".
---

# mobile-api-extraction

Consumes raw leads from `mobile-android-apk`, `mobile-ios-ipa`, or captures and produces a verified catalog plus a spec that `app-spec` / `app-build` can implement against *your own* backend or a licensed public API.

## Authorization / clean-room gate (do first)
- Inputs must already be covered by an `appclone/internals/*/scope.md` (own app, licensed, or public-interface behaviour). If not, stop and run the matching `mobile-*` skill's gate or `app-internals`.
- Static evidence by default. Do NOT call the original vendor's private endpoints, replay tokens, or use harvested keys/credentials. Live probing is allowed only against a backend the user owns or an official public API with the user's own key.
- The spec describes behaviour (shapes, status semantics, auth contract), not the vendor's code, internal names, or proprietary data. Rename identity fields; the reimplementation owns its brand, domain and data.
- Secrets found in evidence are never copied to the catalog or spec: record `<redacted:len=N>` + location, and flag for rotation.

## Workflow
1. **Collect leads** into `appclone/api/leads/`: run `python scripts/extract_endpoints.py <decompiled-or-extracted-dir> --json > leads/extract-<src>.json` for each tree (jadx output, apktool output, IPA `analysis/`, extracted RN/Cordova bundles, firmware roots). Merge with `find-api-calls.sh` reports and HAR files (`references/capture-to-catalog.md`).
2. **Seed the catalog.** `python scripts/catalog_tool.py seed leads/extract-android.json > catalog.csv` (add `--host` when several hosts exist). Columns: `host,method,path,auth,party,confidence,evidence,request,response,notes`.
3. **Classify** every host/path as `first` or `third` party using [references/catalog-rules.md](references/catalog-rules.md) (SDK analytics, crash, ads, push, payments are third party: keep them in the catalog but they never enter the spec as operations to implement; list them as integrations).
4. **Fill gaps from evidence** (not memory): method/param/body from Retrofit interfaces or request builders, headers from interceptors, response shape from DTO classes (`@SerializedName`, `Codable` CodingKeys) or captured samples. Set `confidence`: `observed` (capture/code-read of the call site), `inferred` (annotation or string only), `guess` (naming heuristics).
5. **Resolve base URL and environments**: BuildConfig/Info.plist/remote config; list staging/prod hosts; mark runtime-built ones as unknown.
6. **Auth contract**: login/refresh/logout/anonymous/OTP flows, token transport (header/cookie), refresh triggers (401 handling), request signing/nonce/timestamp. Describe the algorithm abstractly (inputs, order, encoding) for the reimplementation; never include the vendor's key.
7. **Generate the spec.** `python scripts/catalog_tool.py openapi catalog.csv --title "<Your App> API" > openapi.json`. Only `party=first` rows with a real method become operations; others are reported on stderr. Hand-complete request/response schemas from DTO evidence ([references/catalog-rules.md](references/catalog-rules.md)).
   - The output is a draft: unknown hosts produce an empty `servers` list and `x-server-unknown`; request notes stay in `x-request-evidence` instead of an invented JSON schema. API-key/cookie/signature names remain unknown until measured. Automatic redaction is heuristic, not a substitute for reviewing every exported field.
8. **Design the reimplementation contract** ([references/to-app-spec.md](references/to-app-spec.md)): decide which operations the clone really needs (feature matrix first), map to `app-spec` route table (`method path | purpose | caller | input | output | flow`), schema tables, and error model; add idempotency, pagination, rate-limit notes; flag anything that only existed for vendor analytics/anti-abuse.
9. **Contract tests**: for each kept operation write a request/response example from sanitized evidence; the clone's backend must pass them (`app-parity-test`).

## Verification gates
- Every catalog row has `evidence`; zero rows with a secret value.
- `openapi.json` parses and validates (`python -m json.tool`; plus `openapi-spec-validator`/`redocly lint` if installed); every `{param}` is declared; every operation states auth or `x-auth-unknown`.
- Counts reconcile: leads -> catalog rows -> operations + third-party + skipped; discrepancies listed.
- 3 random operations re-verified against source by a second read.
- No operation exists that the feature matrix does not need (YAGNI) unless marked `compat`.

## Output layout
```
appclone/api/
  leads/               extractor JSON, HAR, find-api-calls reports
  catalog.csv          verified catalog (source of truth)
  integrations.md      third-party hosts/SDKs
  auth.md              auth + signing contract (abstract)
  openapi.json         first-party operations
  examples/            sanitized request/response pairs
  unknowns.md          runtime-built URLs, undecoded bodies, gated flows
```
Summary to the user: rows, first/third split, confidence histogram, auth type, top unknowns, next skill (`app-spec`).

## References
- [catalog-rules.md](references/catalog-rules.md) - classification, dedup, confidence, DTO to schema, GraphQL/gRPC/WebSocket notes
- [capture-to-catalog.md](references/capture-to-catalog.md) - authorized HAR/proxy captures, pinning, redaction
- [to-app-spec.md](references/to-app-spec.md) - mapping the catalog into app-spec routes/schema

## Sources
- EncidXVII/claude-reverse-engineering-skill (Apache-2.0): extract_endpoints.py, web-APIs/protocol playbook.
- SimoneAvogadro/android-reverse-engineering-skill (Apache-2.0): two-tier endpoint documentation, third-party host filtering.
- incogbyte/android-reverse-engineering-claude-skill and incogbyte/iOS-reverse-engineering-claude-skill (Unlicense): endpoint documentation templates, library patterns.
- `scripts/catalog_tool.py` is original to replica-suite.

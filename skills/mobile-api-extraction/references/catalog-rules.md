# Catalog rules

## Classification
- First party: host under the app's own domain(s) (from BuildConfig/Info.plist/bundle id/store listing) or an API the app's backend owns.
- Third party: analytics (Firebase, Amplitude, Mixpanel, AppsFlyer, Adjust), crash (Sentry, Crashlytics), ads, push (FCM/APNs), payments (Stripe, billing SDKs), maps, auth providers, CDNs. Android: seed from `mobile-android-apk/references/third_party_hosts.txt`. Third-party rows stay in `integrations.md`; a reimplementation chooses its own provider.
- Unknown: keep, mark `unknown`, resolve before spec.

## Dedup and normalization
Normalize `:id`, `${id}`, `%s`, `{id}` to `{id}`; merge same method+path across Android/iOS/web and record all evidence. Strip query strings from path and move params to `request`. Version prefixes (`/v1`) belong in path; base URL is the server.

## Confidence
`observed`: call site or capture read. `inferred`: annotation/string only. `guess`: naming. Spec sections built on `guess` rows are labelled draft.

## DTO to schema
Android: `@SerializedName`/`@Json(name=)`/kotlinx `@SerialName` field names + Kotlin nullability (`?`) = optional. iOS: `Codable` `CodingKeys`, optionals. Enums: collect literal values seen. Do not copy DTO class names that carry vendor branding; pick neutral schema names.

## Protocol notes
- GraphQL: one endpoint; catalog each operation name and document, plus variables; extract persisted-query hashes as evidence only.
- gRPC: find `.proto` descriptors or `FileDescriptorProto` bytes in assets/strings; describe services/methods; OpenAPI is a poor fit, emit `.proto` instead.
- WebSocket/SSE: catalog URL, auth on connect, message envelope, event types; document in `api/realtime.md`.
- Pagination, error envelope, status semantics, idempotency headers: record once globally in `auth.md`/`conventions.md`.

## Request signing
Record: signed fields and their order, algorithm family (HMAC-SHA256 etc.), encoding, timestamp/nonce rules, where the key comes from (embedded, derived, server-issued). The clone designs its own scheme or uses standard auth; it must never ship the vendor's embedded key.

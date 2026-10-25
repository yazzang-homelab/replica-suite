# Call flows and endpoint patterns

## Grep anchors per stack (run in `decompiled/sources`)
- Retrofit: `@(GET|POST|PUT|DELETE|PATCH|HEAD|HTTP)\(`, `@(Path|Query|QueryMap|Body|Field|Header|Headers|Url|Multipart|Part)\b`, `Retrofit.Builder` + `.baseUrl(`, `@FormUrlEncoded`.
- OkHttp: `new Request.Builder()`, `.url(`, `.addHeader(`, `Interceptor`, `Authenticator`, `CertificatePinner`, `HttpUrl.parse`.
- Ktor: `HttpClient(`, `defaultRequest`, `url("`, `bearer {`, `install(ContentNegotiation)`.
- Apollo/GraphQL: `ApolloClient`, `.serverUrl(`, `query ` / `mutation ` literals, persisted-query `sha256Hash`.
- Volley: `StringRequest`, `JsonObjectRequest`, `Request.Method`.
- URLConnection: `HttpURLConnection`, `openConnection`, `setRequestProperty`.
- WebSocket/SSE: `WebSocketListener`, `newWebSocket(`, `wss://`, `EventSource`.
- Auth: `Authorization`, `Bearer`, `X-Api-Key`, token refresh `Authenticator`, signing helpers (`HmacSHA256`, `Mac.getInstance`, timestamp+nonce builders).
- Config: `BuildConfig.*`, `RemoteConfig`/`getString("api_`, `strings.xml` values with `http`.

## Tracing procedure
Application.onCreate -> client factory (interceptors add headers: read them, they define the auth contract) -> DI modules -> API interface -> Repository -> ViewModel -> click handler. For each key feature write one chain: `Screen -> VM.method -> Repo.method -> Api.method -> METHOD path`.
On obfuscated code, search the path literal, jump to the interface method, then use "find usages" via grep on the (obfuscated) method name.

## Tier 1 table
`| Host | Method | Path | Auth | Source file:line | Party | Confidence |`

## Tier 2 template
```
### METHOD /path
Source / Base URL / Path params / Query params / Headers / Request body (field: type, required?) /
Response type (DTO fields) / Error shapes seen / Called from (chain) / Evidence ids / Unknowns
```
Rules: never record real tokens, keys or user data values; write `<redacted:len=NN>` and the location. Record request signing or anti-replay as a first-class finding because a clean-room client must implement it from the *spec*, not from the app's code.

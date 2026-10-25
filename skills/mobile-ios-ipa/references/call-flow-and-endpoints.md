# Call flows and endpoint patterns

## Anchors (search class-dump headers, strings, disassembly)
- URLSession: `dataTaskWithRequest`, `dataTaskWithURL`, `URLRequest`, `httpMethod`, `setValue:forHTTPHeaderField:`, `URLComponents`, `uploadTask`, `URLSessionDelegate`.
- Alamofire/Moya/AFNetworking: `AF.request`, `Session`, `Router`/`TargetType` (`baseURL`, `path`, `method`), `AFHTTPSessionManager`, `GET:parameters:`.
- Async/Combine: `URLSession.shared.data(for:)`, `dataTaskPublisher`.
- GraphQL: `Apollo`, `query`/`mutation` literals, `operationName`, persisted-query hashes.
- WebSocket: `URLSessionWebSocketTask`, `SRWebSocket`, `Starscream`, `wss://`.
- Auth: `Authorization`, `Bearer`, `kSecAttrAccount`, `SecItemAdd` (token storage), OAuth redirect schemes, `ASAuthorization` (Sign in with Apple).
- Security: `SecTrustEvaluate`, `TrustKit`, `pinnedCertificates`, ATS keys.
- Config: plist keys like `API_BASE_URL`, `xcconfig`-derived Info.plist values, `GoogleService-Info.plist`.

## Tracing
Entry (`AppDelegate`/`@main`) -> network client init (base URL, interceptors, header adapters) -> service protocol/impl -> ViewModel -> view. For each key feature write one chain: `Screen -> ViewModel.method -> Service.method -> METHOD path`. Selector names in `__objc_methname` plus class headers usually suffice for ObjC; for Swift, rely on strings and disassembly of the thin slice.

## Catalog row
`| Host | Method | Path | Auth | Evidence (file/class/string) | Party | Confidence |`
Tier 2 detail (auth, payments, anomalies): params, headers, body schema, response DTO, caller chain, signing/anti-replay, unknowns. Mask secrets as `<redacted:len=NN>`.

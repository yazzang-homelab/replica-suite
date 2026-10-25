# Authorized captures to catalog

Use only for traffic from a device/app you own or are authorized to test, on a disposable profile.
1. Capture: proxy (mitmproxy, Charles) with a user-installed CA, or export a HAR. Record app version, device, date, scenario in `leads/capture-notes.md`.
2. Pinning: if TLS fails, the app pins. On your own build, use a debug network-security config / disable pinning flag. For third-party apps, do not bypass; fall back to static evidence.
3. Convert: for each flow keep method, scheme+host, path template, query keys, header names (values redacted), request JSON shape, response JSON shape, status codes, timing/order. Replace ids/tokens/emails with typed placeholders.
4. Redact before writing to disk: `Authorization`, cookies, device ids, personal data, API keys -> `<redacted:len=N>`; delete the raw HAR from the repo.
5. Merge into `catalog.csv` with `confidence=observed` and evidence `capture:<id>`; note which scenarios were NOT exercised.
6. Reproduce shapes against your own backend, never replay captured credentials against the vendor.

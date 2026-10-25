# Security surface notes (report-only, authorized targets)

Collect while reading the manifest; these affect a reimplementation's threat model and are worth reporting to the owner:
- Exported activities/services/receivers/providers without permission; intent filters with `autoVerify` and custom schemes (deep-link parameter handling).
- `android:debuggable`, `allowBackup`, `usesCleartextTraffic`, trust of user CAs in `network_security_config`, pinned domains/pins.
- Fragment injection: exported activities extending `PreferenceActivity` that honour `:android:show_fragment` without `isValidFragment` (legacy targets).
- Firebase/Google config: `google-services.json` or `strings.xml` keys (`google_api_key`, `firebase_database_url`, `google_app_id`). A client API key is not a secret by itself; open Realtime Database rules or unrestricted keys are findings. Verify misconfiguration only against projects you own or are explicitly authorized to test; passive config extraction is fine, probing third-party backends is not.
- Hardcoded secrets: mask in artifacts (`AKIA…[masked]`), report file:line and rotation advice.
- Local storage: SharedPreferences/SQLite holding tokens, WebView `setJavaScriptEnabled` + `addJavascriptInterface`, `setAllowFileAccess`.
Severity = impact x confidence; list FP-likelihood for pattern-only hits.

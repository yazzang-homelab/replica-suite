# jadx / apktool recipes

jadx (via `scripts/decompile.sh`, or directly):
- `jadx -d out --show-bad-code app.apk` keep partially decompiled bodies instead of dropping them.
- `--deobf` renames short/illegal identifiers to stable `C0001a`-style names; use it for readable cross references, then rely on strings, not names.
- `--no-res` skips resources: fast first pass on huge apps.
- `-j 4` bounds threads; `--no-debug-info` shrinks output.
- Output: `out/sources/` (Java), `out/resources/` (decoded manifest, `res/`, `assets/`).

apktool (use when jadx fails or you need smali/resources exactly):
- `apktool d app.apk -o app_src` -> `smali*/`, `AndroidManifest.xml` as text, `res/`, `assets/`.
- Smali is ground truth: look up a failed jadx method by class path under `smali*/`. Retrofit annotations appear as `.annotation runtime Lretrofit2/http/GET;` with `value = "..."`.
- Do not rebuild/re-sign other people's apps. Rebuilding is only for your own debug builds.

Split/bundle handling: XAPK is a zip with `manifest.json` plus APKs; AAB is not installable and is read with `unzip` + `bundletool`-style layout (`base/dex/`, `base/manifest/`). If jadx yields <=10 Java files and the APK contains inner `base.apk`, decompile the inner one.

Large apps: decompile with `--no-res` first, grep, then decompile just the needed classes (`jadx --single-class <fqn>`), keeping total output bounded.

Fernflower route: `app.apk -> dex2jar -> .jar -> Fernflower`; compare to jadx per failing class and keep the better one in notes.

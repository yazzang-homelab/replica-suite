# Framework routing (decide before decompiling)

| Fingerprint marker | Where logic lives | Route |
|---|---|---|
| `libflutter.so`, `libapp.so`, `flutter_assets/` | AOT Dart in `libapp.so` | Flutter mobile skill (blutter-style symbol recovery, strings, snapshot version); Java is only a shell |
| `assets/index.android.bundle`, `libhermes.so` | JS or Hermes bytecode | extract bundle; Hermes needs a disassembler matched to bytecode version; then JS endpoint scan |
| `assets/www/`, `capacitor.config.json` | web assets | treat as a website: read JS/HTML directly |
| `Xamarin*.dll`, `assemblies/` | .NET assemblies | .NET decompiler (ILSpy-class) on `.dll`, unpack blob if compressed |
| `libunity.so`, `global-metadata.dat`, `Assembly-CSharp.dll` | Mono or IL2CPP | Unity mobile skill |
| Kotlin Multiplatform / native | DEX | continue with this skill |

Mixed apps exist (native shell + web view + native lib). Run `extract_endpoints.py` (see `mobile-api-extraction`) on every extracted text tree, not only jadx output.
Native `.so` with the sensitive logic (signing, crypto): list with `readelf -Ws`/`strings`, then hand to the native triage skills; JNI names `Java_<pkg>_<class>_<method>` link the Java side to the export.

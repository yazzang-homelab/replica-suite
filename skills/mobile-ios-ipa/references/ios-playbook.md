# iOS playbook

## IPA anatomy
`unzip -q App.ipa -d ipa/` -> `Payload/App.app/`: executable (same name as `CFBundleExecutable`), `Info.plist` (often binary plist: convert with plutil/plistutil/python plistlib), `embedded.mobileprovision` (team, devices, entitlements), `Frameworks/*.framework|*.dylib`, `PlugIns/*.appex` (extensions have their own binaries), `Assets.car`, `*.lproj`, `SC_Info/` (FairPlay metadata).
Fat binaries: `lipo -info` / `ipsw macho info` shows slices; thin with `--thin arm64`.

## Encryption (cryptid)
`otool -l App | grep -A4 LC_ENCRYPTION_INFO` : `cryptid 1` = encrypted. App Store builds are encrypted per-device; own Xcode/enterprise/ad-hoc builds are not. Decrypted dumps come from running the app on a device the user owns and capturing memory. That is a user-authorized runtime action; document tool and device. Frameworks may be unencrypted even when the main binary is not.

## Static reading order
1. Info.plist + entitlements + provisioning profile.
2. `otool -L` / linked libs: networking and SDK frameworks present.
3. ObjC metadata (`__objc_classlist`, `__objc_methname`) gives class/selector names; Swift keeps type metadata (`__swift5_types`, `__swift5_proto`) but mangles names.
4. Strings with `http`, `/v1/`, `graphql`, `Bearer`, header names, JSON keys; `cstring` + `__objc_methname`.
5. Symbols imported from `CFNetwork`/`NSURLSession`/`Security` show what the code can do.

## Non-native stacks
- React Native: `main.jsbundle` (JS or Hermes bytecode); extract and run the JS endpoint scan from `mobile-api-extraction`.
- Flutter: logic in `App.framework/App` AOT snapshot; Obj-C dump is useless; use strings + Flutter-specific snapshot tooling.
- Unity: `UnityFramework`, `Data/Managed` or `global-metadata.dat` (IL2CPP).
- Cordova/Capacitor: `www/` folder, read directly.
- WebView-heavy apps: endpoints often live in bundled JS and remote config, not in Mach-O.

## Dynamic confirmation (owned device, approved)
Hook `NSURLSession dataTaskWithRequest:`, `-[NSMutableURLRequest setValue:forHTTPHeaderField:]`, or Swift `URLSession` wrappers to log method/URL/headers with secrets masked; or proxy with a user-installed CA. Pinning bypass only on your own app/test build.

## Pitfalls
Stripped Swift binaries hide method bodies; absence of a string does not mean absence of an endpoint (runtime concatenation, base64/XOR-obfuscated literals, remote config). Report these as unknowns.

# Playbooks (authorized targets only)

## Electron / ASAR
1. Identify: app dir, `resources/app.asar` (or unpacked `app/`), Electron version from the framework binary, `package.json` (`main`, `dependencies`, scripts, updater config).
2. Packaged fuses: read the fuse wire in the Electron binary (RunAsNode, NodeCliInspect, EmbeddedAsarIntegrityValidation, OnlyLoadAppFromAsar...). Disabled inspect fuse = no main-process debugging. Record each fuse state.
3. Static map: main entry, preload scripts, `BrowserWindow` options (`nodeIntegration`, `contextIsolation`, `sandbox`, `webSecurity`), IPC channels and handlers (`ipcMain.handle/on` vs `contextBridge.exposeInMainWorld`), custom protocols, auto-update, native modules (`.node`), local storage (SQLite, JSON), remote origins/endpoints.
4. Large ASARs: header admission limits can reject huge archives; raise the documented limit setting and retry the same request rather than selecting subsets to dodge it.
5. Behaviour: renderer behaviour of an already-open, user-owned instance is observable passively over loopback CDP. Findings -> screens/flows/data model in `app-recon` terms.
6. Output for rebuild: IPC contract table (channel, payload shape, direction), persisted data schemas, window/menu structure, settings keys.

## Android APK (never launched; no emulator required)
1. Identity + manifest: package, versionName/Code, SDK levels, permissions, exported components, intent filters, deep links, network security config, signature scheme (v1/v2/v3/v4 via offline APK signature inspection; signatures not cryptographically verified by inspection alone).
2. Class search -> class members -> method decompile -> incoming static references. Choose overloads by index from the class inventory, never guess. Reflection, dynamic loading, native `.so` calls and unresolved calls remain unknown.
3. Resources: apktool decode for layouts, strings, navigation graphs -> screen inventory and nav graph for `app-recon`.
4. Data/protocol: Room/SQLite schemas, Retrofit interface definitions, protobuf descriptors -> data model and API shape (as behaviour spec, not copied source).
5. Cross-platform runtimes: Flutter (`libapp.so`, assets), React Native (`index.android.bundle`, Hermes bytecode), Unity (IL2CPP metadata) each need their own route before concluding anything.

## Web bundles / captured sites you own or may analyse
Recover readable source to a new directory with each input's digest kept; inventory routes as candidates (static patterns never prove reachability); trace import relationships for one script at a time; compare source to bundle export shapes; reconcile with passive runtime capture by content digest. For line-traceable rebuilds see `app-forensic-rebuild`.

## Ethics reminders
No credential/token harvesting, no bypassing licence checks or protections, no traffic interception you are not authorized to perform, no publishing of third-party proprietary code. Findings are summarized as behaviour.

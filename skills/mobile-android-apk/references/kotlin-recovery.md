# Kotlin name recovery (obfuscated apps)

R8 renames JVM symbols but the Kotlin runtime needs metadata strings, so two sources keep original names:
1. `@DebugMetadata(c = "pkg.RealName", f = "File.kt", m = "...")` on coroutine continuations: almost every `suspend` function yields its owner's real FQN.
2. `@Metadata(d2 = {...})` string arrays: `L<pkg/Class>;` internal references inside a file; also `toString()` literals of data classes (`"UserDto(id="`) and `Intrinsics.checkNotNullParameter(x, "paramName")` calls.

Procedure: run `recover-kotlin-names.sh <sources> <mapping>`; inspect `mapping.tsv` (`obf<TAB>real<TAB>file`); use `lookup-name.sh <mapping> --grep REGEX <sources>` so each hit is annotated with the real owner. Expect near-complete recovery for Repository/ViewModel/UseCase/Impl, partial for DTOs; plain Java classes are not recovered.
Limits: names come from the app's own strings, so treat them as hints; a mapping hit is evidence of a name, not of behaviour. Also check for a shipped `mapping.txt` only if the user supplied it (build artifact they own).
Fallback anchors when nothing maps: string literals (paths, JSON keys, header names), Retrofit annotations, `@SerializedName`/`@Json(name=)` values, log tags, resource IDs in `R` usage.

# Control surfaces

## analyzeHeadless
```bash
"$GHIDRA_INSTALL_DIR/support/analyzeHeadless" "$PROJ_DIR" myproj \
  -import "$COPY_OF_SAMPLE" -overwrite \
  -analysisTimeoutPerFile 600 \
  -scriptPath ./scripts -postScript ghidra_export_summary.py
```
- Add `-noanalysis` to import only, fix language/base, then run analysis once. Re-run without `-import` using `-process <name> -noanalysis -postScript ...` for query scripts on the cached project.
- Serialize access to one project; a locked project must be closed first. A project edited in the GUI invalidates cached exports.
- Exit code 0 can still mean partial (timeout, cap, decompiler failure): inspect the export's status/warnings.

## PyGhidra library mode
Prefer for loops that mutate. Rules that cost time:
- Every mutation needs an explicit transaction (`startTransaction` / `endTransaction(tx, True)`); uncommitted changes are discarded silently.
- Java collections and bytes cross JPype oddly: convert bytes explicitly and mask signed values.
- `getCalledFunctions` returns a set: order is not call order.
- Scripts that raise after partial mutation leave committed partial state: rehearse past the first mutation, roll back on raise, keep an undo for a crashed run.
- Discover the API from the installed javadoc/classes rather than recalling signatures (versions differ).

## RPC daemon style (ghidra-rpc pattern)
A long-lived daemon holds the JVM and project; each command is a JSON-in/JSON-out CLI call.
Lifecycle: `start --project X.gpr --headless --detach` -> `status` -> `load <bin>` (flags `--no-analyze`, `--analysis-timeout`) -> queries -> `stop`. Writes auto-save and return a `verified` read-back flag.
Query commands to expect: `metadata`, `functions` (paginated, range filters), `imports`, `exports`, `strings <query>`, `symbols`, `decompile <func|addr>`, `basic-blocks`, `pcode`, `search-decompiled <regex>` (bounded scan), `find-bytes` (wildcards), `xrefs-to`, `xrefs-from --no-stack`, version tracking / function diff for patch analysis.
Mutation commands: rename function/label/variable, set-signature, retype-variable, batch-rename, batch-edit-variable (one decompiler snapshot), create/delete-function, create-struct/enum, set-data-type, set-comment, set-calling-convention, set-thunk, bookmarks, tags.
Practices:
- GUI mode needs the right project and binary open in CodeBrowser; headless does not.
- Set signatures / `this` types before renaming locals; use batch-edit or storage strings because auto names renumber after every retype.
- Renaming a function improves all callers' decompilation immediately: rename as you go, but via the trust model (tier AI) if the daemon allows; otherwise record each rename in your own ledger with `agent-set` marker.
- Android: Ghidra loads DEX/APK natively but `load app.apk` imports only the primary `classes.dex`; extract other dex files separately.
- Patch analysis: load both builds, run version tracking with changed-only, function-diff the changed functions, then bulk decompile unmatched ones.
- Report daemon bugs/missing features back as plain notes; do not work around by editing the database file.

## MCP servers
Read-only queries are fine. Check which `SourceType` mutation tools write (many hardcode `USER_DEFINED`). A mutation through such a server must be recorded in your ledger as agent-set and excluded from evidence by hand. Large pseudocode output belongs in files, not chat.

## GUI keys (human adjudication)
`G` goto, `L` rename, `Ctrl-L` retype, `;` comment, `Ctrl-Shift-E` edit signature, `X` xrefs, `D` disassemble, `C` clear, `F` create function, `T` apply type, `Ctrl-Shift-G` function graph.

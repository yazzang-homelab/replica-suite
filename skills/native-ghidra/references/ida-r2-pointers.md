# IDA and radare2 pointers

Same rules everywhere: record tool+version, bytes win over pseudocode, agent-set names are marked and excluded from evidence, mutate only after backup of the database.

## IDA (Pro/Home/Free)
- Access paths: IDA MCP server (live queries), exported per-function decompilation trees (`decompile/<addr>.c` with callers/callees headers, `strings.txt`, `imports.txt`, `exports.txt`), or headless **IDALib** (IDA 9+, `import idapro`).
- MCP operational gotchas seen in practice: some MCP clients reject structured output of the "open database" tool: open via the server's HTTP endpoint instead; background-start the server so it does not block; auto-analysis on open can look hung, so poll with a timeout; failed opens can leave orphan worker processes holding `.id0/.id1/.nam` locks: kill the process tree; files in protected system directories should be copied before opening.
- IDAPython map: `idautils.Functions()`, `idc.get_func_name`, `idc.get_name_ea`, `ida_funcs.get_func/add_func`, `idc.create_insn/del_items`, `ida_bytes.create_strlit`, `ida_bytes.find_bytes` (pattern with `??`), `idc.get_bytes`, `idaapi.get_imagebase`, `idautils.XrefsTo(ea)`, `ida_hexrays.decompile(ea)`; debugger: `idc.get_reg_value`, `idc.read_dbg_memory`, `idc.add_bpt` (live debugging belongs in `native-trace` sandbox rules). Patching the IDB (`idc.patch_byte`) does not touch the file; keep patch lists as artifacts.
- Names applied by script: prefix or comment-mark agent-set names (IDA has no SourceType tier) and keep `symbols.csv`.
- Use Hex-Rays output like Ghidra's: lossy, check signedness and casts in disassembly.

## radare2 / rizin
```bash
rabin2 -I bin; rabin2 -zz bin; rabin2 -i bin; rabin2 -E bin      # info, strings, imports, exports
r2 -q -c 'aaa; afl; iz; axt @ sym.main; pdf @ main' bin           # analyse, list, strings, xrefs, disassemble
r2 -A -q -c 'axt @@ str.*' bin                                    # every string with referrers
rasm2 -a x86 -b 64 'nop'; radiff2 -g main old new; rahash2 -a sha256 bin
```
- Triage first (`rabin2`), `aaa` before `aaaa`; analyse a window for huge files.
- Read-only open by default; `-w`/`oo+` only for an explicitly requested patch on a copy.
- JSON everywhere: `ij`, `aflj`, `izj`, `iij`, `axtj`; save command output to files.
- r2pipe scripts for loops; keep them in `scripts/` with the exact command.
- Windows `.sdb` missing warnings do not by themselves invalidate rabin2 output.
- Rizin/Cutter MCP setups: discover installed interface, start bounded jobs, read evidence pages before reporting.

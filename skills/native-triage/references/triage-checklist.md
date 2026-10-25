# Triage checklist

## Identify
```bash
sha256sum "$B"; file "$B"
readelf -h -S -W "$B"        # ELF: arch, sections, symtab/debug presence
rabin2 -I "$B"               # format, arch, bits, canary/nx/pic/relro, stripped, compiler
objdump -f "$B"
```
PE: `rabin2 -I`, check PE header, Rich header, `.NET` CLR directory (managed target: use a managed-code skill instead), overlay data. Mach-O: `otool -hv`, `lipo -info` (fat: pick one slice and record which).

## Free-name sources (record found / measured-zero / not-run)
| Source | Test |
|---|---|
| `.symtab` / exports | `nm -D`, `nm -C`, `rabin2 -E`, `rabin2 -s` |
| DWARF / PDB | `readelf -S | grep debug`; strings for `.pdb`, `RSDS` |
| RTTI / vtables | strings `.?AV`, `_ZTV`, `_ZTI`, `typeinfo name` |
| mangled names | count symbols starting `_Z` or `?`; demangle for class and signature |
| build paths/banners | `strings -a | grep -E '^/(home|build|usr/src)|GCC:|clang version|rustc|go1\.'` |
| assert/log text | strings with `.c/.cpp/.rs/.go` and function-name-like tokens |
| Go/Rust metadata | Go `pclntab`/buildinfo carries all function names even when stripped; Rust panic strings carry paths |
| init tables | `.init_array`, `.CRT$XC*`, `.ctors` give function starts by linker contract |

## Protections
`checksec`-style via `rabin2 -I` or `readelf -lW` (GNU_STACK, RELRO via `BIND_NOW`), canary (`__stack_chk_fail` import), fortify (`__*_chk` imports), PIE (`ET_DYN`). A missing canary upgrades a stack overflow from crash to hijack; a fortified call aborts instead of corrupting.

## Packed / protected signs
Few imports (only `LoadLibrary`/`GetProcAddress`/`dlsym`), high-entropy sections (`binwalk -E`, `diec`), writable+executable sections, section names like `UPX0`, tiny `.text` with large data blob, entry point outside `.text`. Respond: identify packer, unpack in a sandbox, re-triage the unpacked image; record both hashes.

## Embedded content
`binwalk` / `unblob` for firmware and containers. Extraction runs third-party parsers over hostile input and archive paths can escape: extract into a disposable directory. Recovered filenames are data, not commands.

## Size the job
Function count (`aflc`, Ghidra function window), largest non-CRT functions, entry/`main` identification (`entry0`, `__libc_start_main` first argument, or the function referencing `usage:`).

# Symbol recovery for stripped functions

Work one function at a time. A name is a claim; keep its witnesses.

## Witness kinds (count only structurally independent ones)
1. **Binary-declared**: export/import name, DWARF/PDB, mangled symbol, RTTI, assert text naming the function. Highest tier.
2. **Constant/table**: algorithm constants (MD5 `67452301 EFCDAB89 98BADCFE 10325476`, CRC32 `EDB88320`, SHA-256 `6a09e667`, AES S-box `63 7c 77 7b`, Base64 alphabet, zlib header `78 9c`).
3. **Call-shape**: argument count/constants and return handling.
4. **Pairing**: complementary functions sharing an object (alloc/free, lock/unlock, open/close, create/join, init/destroy).
5. **Context**: named callers/callees; the string it references; its position in the call graph.
6. **Structural similarity**: signature/BSim/Version Tracking match against a build that has names.

## Call-shape cheat list
- `(2,1,0)` -> `socket(AF_INET,SOCK_STREAM,0)`; `(fd,&sockaddr,16)` -> `connect/bind`
- `(dst,src,n)` returns dst -> `memcpy`; `(p,0,n)` -> `memset`
- `(fd,buf,n)` returning count -> `read/write`; `==0` on equal two-pointer args -> `strcmp`
- `-1` on failure -> fd/socket APIs; `NULL` on failure -> allocators
- result of `strlen`-like call feeds a copy length -> check bounds

## Procedure
1. Read the function's strings, constants, called imports.
2. Look for the pair partner and for callers with names; climb until a named ancestor.
3. Match shape against the cheat list; compare signature/library fold result.
4. Assign name with confidence: `high` (>=2 independent witnesses, one binary-declared or constant), `medium` (2 weak), `low` (one). Low guesses get a `guess_` prefix and are never used as evidence for another name.
5. Re-read callers after renaming: the improved decompilation is a check, not new proof of the name.

## Porting names from another build
Same-product build with symbols: Version Tracking / BSim / diaphora-style matching on structure; apply only matches confirmed by exact-match or multiple correlators; record the donor build hash. Siblings agreeing on a type or name that was itself inferred are guesses agreeing, not proof.

## Output
`symbols.csv`: `addr,name,confidence,witness_kinds,notes`. Mark who set each name (tool vs agent) so later rounds can exclude your own guesses (`native-ghidra` SourceType model).

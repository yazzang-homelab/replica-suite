# Parity signals and overrides

Mechanical checks comparing candidate source with binary-side facts. Severity red/yellow/info.

| Signal | Typical severity | Meaning |
|---|---|---|
| missing source | red | no candidate found for the address |
| stub marker | red | TODO/unimplemented/empty body |
| trivial stub | red | body returns constant while binary has real logic |
| large asm, tiny source | red/yellow | size ratio implies dropped logic |
| short body | yellow | few statements; may be legitimate inline wrapper |
| low call count | yellow | fewer calls than the binary makes |
| call count mismatch | red | calls differ from xrefs_from set |
| FP sensitivity | yellow | float ops: verify operand order and precision |
| NaN logic | yellow | comparisons whose NaN behaviour must match |
| inline wrapper | info | thin forwarding function |
| plugin/hook heavy | yellow | mostly calls into original binary instead of own logic |

## Project overrides
- Semantic rules (JSON): `{id, reason, severity, addresses[], symbols[], source_all_of[], source_any_of[]}` raise or lower severity for project-specific patterns.
- Manual approval list: lines `- [x] 0xADDR note` mark a human-reviewed function; allowed to clear YELLOW, never RED structural mismatches without a written reason.
- Cache index results keyed by file hash so reruns are cheap; invalidate on source change.

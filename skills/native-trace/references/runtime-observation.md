# Runtime observation

## Sandbox rules (before any execution)
- Disposable VM or container with snapshots; no real credentials; network off, or routed to a logging sink. Match the target architecture or use emulation (qemu-user/Unicorn) rather than guessing.
- Copy the sample; hash before and after; run as an unprivileged user.
- Unknown/hostile sample or anything touching third-party infrastructure: stop and get explicit user approval.
- Never trust instrumented results as findings about the original: a hostile-allocator crash, fuzz input or sanitizer report on a lifted/rebuilt function must reproduce against the **original binary**.

## Pick the lightest probe
| Question | Probe |
|---|---|
| which syscalls/files/network | `strace -f -e trace=...`, `ltrace` |
| value at an instruction | gdb/lldb breakpoint + register/memory read; record module base |
| indirect call target | breakpoint or hook at the call, log target as module+RVA |
| call arguments/returns | Frida `Interceptor.attach`, `ltrace`, debugger commands |
| reachability / constraint | emulation (Unicorn/qiling/angr) or symbolic solve; confirm on the real binary |
| decrypted/constructed data | hook at the consumer, dump buffer, hash dump |
| allocator/UAF bugs | hostile allocator preload, ASan on a rebuild, then reproduce on original |

## A tool that did no work is not a clean result
Check that the hook fired, the breakpoint hit, the process reached the code, the ASLR base matches the map, and the run exited for the expected reason. A silent tracer, an arch-mismatched emulator, or a sanitizer that never ran proves nothing. Record `coverage` accordingly.

## Normalize identities
native: module + RVA; managed: assembly+type+method/token; JVM: class+descriptor; JS: script+location; Android: package/component + dex/native identity. Convert with the module base logged in that run. One run proves behaviour for that artifact, input, environment and path.

## Reconciling with static analysis
When runtime disagrees with static:
1. executed artifact is the analysed artifact (hash, path, loader chosen)
2. rebase/normalization correct (ASLR, prelink, thumb bit)
3. patch/version state matches
4. dynamic loading, self-modifying, decrypted or JIT code
5. different input/environment path (args, env, locale, time, network)
6. analysis database stale
Record both sides as separate claims before resolving; resolution is a new derived claim citing both.

## Cross-layer boundaries
Keep per-layer identities separate. Bridges: IPC/preload, native addons, P/Invoke/COM, JNI, ObjC/Swift runtime, sockets/RPC, files/DBs/shared memory, command line/env, serialization. For each bridge record producer, consumer, channel, payload shape, registration evidence and runtime confirmation. A shared string is a clue, not a bridge. Trace a bounded chain: source event -> bridge -> handler -> downstream effect, then stop.

## Artifacts to keep
Command line, environment, input hash, tool version, raw output file, base addresses. Regenerable bulk (full traces) stays as command + hash, not pasted into notes.

#!/usr/bin/env python3
"""Resumable investigation ledger for native-trace (original work, replica-suite).

Append-only JSONL under <dir>/ledger.jsonl plus a regenerated <dir>/NEXT.md view.
Stdlib only. Usage:

  trace_ledger.py init   DIR --objective "..." --artifact PATH [--artifact PATH ...]
  trace_ledger.py add    DIR --kind observed|derived|inferred|rejected|probe --text "..."
                         [--loc "module+0x1234"] [--dep E3 --dep E5] [--tool NAME]
                         [--coverage complete|partial|failed|unknown] [--bound "search limits"]
  trace_ledger.py next   DIR --question "..." --probe "exact next operation"
  trace_ledger.py check  DIR          # re-hash artifacts; mark drift; validate dependency ids
  trace_ledger.py show   DIR          # print resume view (also writes NEXT.md)
  trace_ledger.py advance DIR --artifact OLD=NEW   # bind a new build; old claims go stale

Rules enforced: observed claims need --loc; derived/inferred need --dep; dependencies must
exist and may not be stale-only for a current claim; negative/absence claims need --bound.
"""
import argparse, hashlib, json, os, re, sys, time


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load(d):
    p = os.path.join(d, "ledger.jsonl")
    if not os.path.exists(p):
        sys.exit("no ledger; run init")
    with open(p, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def append(d, rec):
    rec["ts"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    with open(os.path.join(d, "ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, sort_keys=True) + "\n")


def revs(v):
    return set(v) if isinstance(v, list) else {v}


def state(recs):
    arts, claims, nxt, obj = {}, {}, None, ""
    stale = set()
    for r in recs:
        t = r["type"]
        if t == "init":
            obj = r["objective"]
            arts.update(r["artifacts"])
        elif t == "advance":
            for old, new in r["map"].items():
                arts[new["path"]] = new
                if old in arts:
                    arts[old]["historical"] = True
            stale |= {c for c, v in claims.items() if revs(v["artifact_rev"]) & set(r["map"])}
        elif t == "drift":
            stale |= set(r["roots"])
        elif t == "claim":
            claims[r["id"]] = r
        elif t == "next":
            nxt = r
    # close stale over dependencies
    changed = True
    while changed:
        changed = False
        for cid, c in claims.items():
            if cid not in stale and any(d in stale for d in c.get("deps", [])):
                stale.add(cid)
                changed = True
    return obj, arts, claims, stale, nxt


def view(d):
    obj, arts, claims, stale, nxt = state(load(d))
    out = ["# Resume view (generated; ledger.jsonl is canonical)", f"Objective: {obj}", "", "## Artifacts"]
    for p, a in arts.items():
        out.append(f"- {p} sha256={a['sha256'][:16]} size={a['size']}" + (" [historical]" if a.get("historical") else ""))
    out += ["", "## Claims"]
    for cid, c in claims.items():
        flag = " STALE" if cid in stale else ""
        out.append(f"- {cid} [{c['kind']}{flag}] {c['text']} @ {c.get('loc') or '-'} deps={c.get('deps',[])} cov={c.get('coverage','unknown')}"
                   + (f" bound={c['bound']}" if c.get("bound") else ""))
    out += ["", "## NEXT"]
    out.append(f"Question: {nxt['question']}\nProbe: {nxt['probe']}" if nxt else "(none set)")
    text = "\n".join(out) + "\n"
    with open(os.path.join(d, "NEXT.md"), "w", encoding="utf-8") as f:
        f.write(text)
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["init", "add", "next", "check", "show", "advance"])
    ap.add_argument("dir")
    ap.add_argument("--objective")
    ap.add_argument("--artifact", action="append", default=[])
    ap.add_argument("--kind", choices=["observed", "derived", "inferred", "rejected", "probe"])
    ap.add_argument("--text")
    ap.add_argument("--loc")
    ap.add_argument("--dep", action="append", default=[])
    ap.add_argument("--tool")
    ap.add_argument("--coverage", default="unknown", choices=["complete", "partial", "failed", "unknown"])
    ap.add_argument("--bound")
    ap.add_argument("--question")
    ap.add_argument("--probe")
    a = ap.parse_args()
    d = a.dir
    if a.cmd == "init":
        if not (a.objective and a.artifact):
            sys.exit("init needs --objective and --artifact")
        os.makedirs(d, exist_ok=True)
        if os.path.exists(os.path.join(d, "ledger.jsonl")):
            sys.exit("ledger exists")
        if len(set(a.artifact)) != len(a.artifact):
            sys.exit("duplicate --artifact path")
        for p in a.artifact:
            if not os.path.isfile(p):
                sys.exit(f"artifact not found: {p}")
        arts = {p: {"path": p, "sha256": sha(p), "size": os.path.getsize(p)} for p in a.artifact}
        append(d, {"type": "init", "objective": a.objective, "artifacts": arts})
    elif a.cmd == "add":
        if not (a.kind and a.text):
            sys.exit("add needs --kind and --text")
        obj, arts, claims, stale, _ = state(load(d))
        if a.kind in ("observed", "derived", "inferred"):
            drifted = [p for p, v in arts.items() if not v.get("historical")
                       and (not os.path.isfile(p) or sha(p) != v["sha256"])]
            if drifted:
                sys.exit(f"artifacts changed since recorded: {drifted}; run check/advance before new claims")
        if a.kind == "observed" and not a.loc:
            sys.exit("observed claims need --loc")
        if a.kind in ("derived", "inferred") and not a.dep:
            sys.exit("derived/inferred claims need --dep")
        for dep in a.dep:
            if dep not in claims:
                sys.exit(f"unknown dependency {dep}")
            if dep in stale:
                sys.exit(f"dependency {dep} is stale; revalidate first")
        if (re.search(r"\b(no|never|not found|absent)\b", a.text.lower()) or a.kind == "rejected") and not a.bound:
            sys.exit("absence/negative claims need --bound describing search limits")
        cid = f"E{len(claims) + 1}"
        cur = [p for p, v in arts.items() if not v.get("historical")]
        append(d, {"type": "claim", "id": cid, "kind": a.kind, "text": a.text, "loc": a.loc, "deps": a.dep,
                   "tool": a.tool, "coverage": a.coverage, "bound": a.bound, "artifact_rev": cur[0] if len(cur) == 1 else cur})
        print(cid)
    elif a.cmd == "next":
        if not (a.question and a.probe):
            sys.exit("next needs --question and --probe")
        append(d, {"type": "next", "question": a.question, "probe": a.probe})
    elif a.cmd == "check":
        obj, arts, claims, stale, _ = state(load(d))
        bad = [p for p, v in arts.items() if not v.get("historical") and (not os.path.exists(p) or sha(p) != v["sha256"])]
        if bad:
            roots = [c for c, v in claims.items() if revs(v["artifact_rev"]) & set(bad)]
            append(d, {"type": "drift", "artifacts": bad, "roots": roots})
            print("DRIFT:", bad, "stale claims:", roots)
            sys.exit(1)
        print("artifacts match recorded hashes")
    elif a.cmd == "advance":
        if not a.artifact:
            sys.exit("advance needs --artifact OLD=NEW")
        obj, arts, claims, stale, _ = state(load(d))
        m = {}
        for spec in a.artifact:
            if "=" not in spec:
                sys.exit(f"bad --artifact {spec!r}; expected OLD=NEW")
            old, new = spec.split("=", 1)
            if old not in arts or arts[old].get("historical"):
                sys.exit(f"unknown or already-historical old artifact: {old}")
            if old in m:
                sys.exit(f"duplicate old artifact: {old}")
            if new == old:
                sys.exit(f"advance must change the path: {old}")
            if new in arts or any(v["path"] == new for v in m.values()):
                sys.exit(f"new artifact already recorded: {new}")
            if not os.path.isfile(new):
                sys.exit(f"new artifact not found: {new}")
            m[old] = {"path": new, "sha256": sha(new), "size": os.path.getsize(new)}
        append(d, {"type": "advance", "map": m})
    if a.cmd in ("show", "add", "next", "advance", "init"):
        t = view(d)
        if a.cmd == "show":
            print(t)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""catalog_tool.py - original replica-suite helper (no upstream code).

Two subcommands that bridge extraction output to a clean-room API spec:

  seed     extract_endpoints.py --json output  ->  catalog.csv skeleton
  openapi  catalog.csv                         ->  openapi.json (OpenAPI 3.0.3)

Catalog columns: host,method,path,auth,party,confidence,evidence,request,response,notes
  auth:       none | bearer | apikey | cookie | signed | unknown
  party:      first | third | unknown      (only 'first' rows become operations)
  confidence: observed | inferred | guess  (kept as x-confidence)
  evidence:   file:line or evidence-ledger id (kept as x-evidence; never a secret)
Rows with method '?' are skipped and reported on stderr.
"""
import argparse, csv, json, re, sys
from collections import OrderedDict
from urllib.parse import urlsplit

COLS = ["host", "method", "path", "auth", "party", "confidence", "evidence", "request", "response", "notes"]
METHODS = {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}
SCHEMES = {
    "bearer": ("bearerAuth", {"type": "http", "scheme": "bearer"}),
}


RANK = {"observed": 2, "inferred": 1, "guess": 0}
SECRET_RE = re.compile(
    r"(?i:bearer\s+[A-Za-z0-9._~+/=-]{8,})"
    r"|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\-]{35}|sk_live_[0-9A-Za-z]{10,}|gh[pousr]_[0-9A-Za-z]{30,}"
    r"|xox[baprs]-[0-9A-Za-z-]{10,}|eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"
    r"|(?i:(?:password|passwd|secret|token|api[_-]?key|authorization)\s*[:=]\s*[^\s,;&]+)")
BLOB_RE = re.compile(r"[A-Za-z0-9+_-]{32,}={0,2}")


def die(msg):
    print("error: " + msg, file=sys.stderr)
    sys.exit(2)


def redact(text, blobs=True):
    """Never copy credential-shaped text from the catalog into the spec."""
    text = SECRET_RE.sub("[REDACTED]", text or "")
    return BLOB_RE.sub("[REDACTED]", text) if blobs else text


def split_url(p):
    """-> (host, path) with query/fragment removed; host is '' for plain paths."""
    p = p.strip()
    if "://" in p:
        u = urlsplit(p)
        return u.netloc.rsplit("@", 1)[-1], u.path
    return "", re.split(r"[?#]", p, 1)[0]


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError) as e:
        die("cannot read %s as JSON: %s" % (path, e))


def seed(args):
    data = load_json(args.extract)
    f = data.get("findings") if isinstance(data, dict) else None
    if not isinstance(f, dict):
        die("%s is not extract_endpoints.py --json output (missing 'findings')" % args.extract)
    seen = list(f.get("host", {}))
    default_host = args.host or (seen[0] if len(seen) == 1 else "")
    rows = OrderedDict()

    def add(m, raw, locs):
        h, p = split_url(raw)
        if not p:
            return
        # FETCH / HTTP (smali @HTTP) carry no verb: method stays unknown
        m = m.upper() if m.upper() in METHODS else "?"
        cur = rows.setdefault((h or default_host, m, p), [])
        cur.extend(l for l in locs if l not in cur)

    for key, locs in f.get("endpoint", {}).items():
        m, _, p = key.partition(" ")
        add(m, p, locs)
    known = {k[2] for k in rows}
    for p, locs in f.get("api_path", {}).items():
        if split_url(p)[1] not in known:
            add("?", p, locs)
    w = csv.writer(sys.stdout)
    w.writerow(COLS)
    for (h, m, p), locs in rows.items():
        w.writerow([h, m, p, "unknown", "unknown", "inferred" if m != "?" else "guess", ";".join(locs[:3]), "", "", ""])
    print("seeded %d rows; hosts seen: %s" % (len(rows), ", ".join(seen) or "-"), file=sys.stderr)


def norm_path(p):
    p = split_url(p)[1]
    p = re.sub(r"(?<=/):(\w+)(?=/|$)", r"{\1}", p)  # /:id -> /{id}
    return p if p.startswith("/") else "/" + p


def server_url(host):
    url = host if "://" in host else "https://" + host
    url = url.rstrip("/")
    u = urlsplit(url)
    try:
        port_ok = u.port is None or u.port > 0
    except ValueError:
        port_ok = False
    if (u.scheme not in ("http", "https") or u.query or u.fragment or "@" in u.netloc or not port_ok
            or not re.fullmatch(r"[A-Za-z0-9.-]+|[0-9A-Fa-f:]+", u.hostname or "")):
        return ""
    return url


def openapi(args):
    ops, servers, used, skipped = OrderedDict(), OrderedDict(), OrderedDict(), []
    try:
        fh = open(args.catalog, encoding="utf-8-sig", newline="")
    except OSError as e:
        die("cannot read catalog: %s" % e)
    with fh:
        try:
            rd = csv.DictReader(fh)
            rows = list(rd)
        except (csv.Error, UnicodeDecodeError) as e:
            die("invalid catalog CSV: %s" % e)
    missing = [c for c in ("method", "path") if c not in (rd.fieldnames or [])]
    if missing:
        die("catalog missing required column(s): %s" % ", ".join(missing))
    for r in rows:
        m = (r.get("method") or "?").strip().upper()
        raw_path = (r.get("path") or "").strip()
        if m not in METHODS or (r.get("party") or "").strip().lower() != "first" or not raw_path:
            skipped.append("%s %s" % (m, raw_path))
            continue
        path = norm_path(raw_path)
        host = (r.get("host") or "").strip() or split_url(raw_path)[0]
        url = ""
        if host:
            url = server_url(host)
            if not url:
                skipped.append("%s %s (invalid host)" % (m, raw_path))
                continue
            servers[url] = 1
        evidence = redact(r.get("evidence"), blobs=False).strip()
        conf = (r.get("confidence") or "").strip().lower()
        conf = conf if conf in RANK else "guess"
        notes = redact(r.get("notes")).strip()
        a = (r.get("auth") or "unknown").strip().lower()
        existing = ops.get(path, {}).get(m.lower())
        if existing is not None:
            # same method+path on another host (or repeated): keep one operation, never drop a host
            if url and url not in [s["url"] for s in existing.setdefault("servers", [])]:
                existing["servers"].append({"url": url})
            if evidence and evidence not in existing["x-evidence"].split(";"):
                existing["x-evidence"] = ";".join(filter(None, [existing["x-evidence"], evidence]))
            if RANK[conf] < RANK[existing["x-confidence"]]:
                existing["x-confidence"] = conf
            if existing.pop("_auth") != a:
                existing.pop("security", None)
                existing["x-auth-unknown"] = True
                existing["_auth"] = "unknown"
            else:
                existing["_auth"] = a
            continue
        params, seen_params = [], set()
        for n in re.findall(r"{([^{}/]+)}", path):
            if n not in seen_params:
                seen_params.add(n)
                params.append({"name": n, "in": "path", "required": True, "schema": {"type": "string"}})
        op = {
            "summary": notes or "%s %s" % (m, path),
            "x-evidence": evidence,
            "x-confidence": conf,
            "parameters": params,
            "responses": {"default": {"description": redact(r.get("response")).strip() or "unspecified - fill from evidence"}},
            "_auth": a,
        }
        if url:
            op["servers"] = [{"url": url}]
        req = redact(r.get("request")).strip()
        if req:
            op["x-request-evidence"] = req
        if a in SCHEMES:
            op["security"] = [{SCHEMES[a][0]: []}]
        elif a == "none":
            op["security"] = []
        else:
            op["x-auth-unknown"] = True
            op["x-auth-kind"] = a
        ops.setdefault(path, OrderedDict())[m.lower()] = op
    for item in ops.values():
        for op in item.values():
            a = op.pop("_auth")
            if a in SCHEMES:
                used[SCHEMES[a][0]] = SCHEMES[a][1]
    spec = OrderedDict([
        ("openapi", "3.0.3"),
        ("info", {"title": args.title, "version": args.version,
                  "description": "Clean-room API description derived from analysis; x-evidence and x-confidence mark provenance."}),
        ("servers", [{"url": u} for u in servers]),
        ("x-contract-status", "draft; verify observations before implementation"),
        ("x-server-unknown", not bool(servers)),
        ("paths", ops),
        ("components", {"securitySchemes": used}),
    ])
    json.dump(spec, sys.stdout, indent=2)
    print("\n%d paths; skipped %d rows: %s" % (len(ops), len(skipped), ", ".join(skipped[:10]) or "-"), file=sys.stderr)


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sub = ap.add_subparsers(dest="cmd", required=True)
s = sub.add_parser("seed"); s.add_argument("extract"); s.add_argument("--host"); s.set_defaults(fn=seed)
o = sub.add_parser("openapi"); o.add_argument("catalog"); o.add_argument("--title", default="Reimplementation API")
o.add_argument("--version", default="0.1.0"); o.set_defaults(fn=openapi)
a = ap.parse_args()
a.fn(a)

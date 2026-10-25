#!/usr/bin/env node
// Capture a page's runtime (HTML/JS/CSS/models/textures/wasm/workers/fonts/media)
// into a local static folder you can serve, so a WebGL/Three.js/Rive scene keeps working.
// Original implementation; architecture follows the runtime-mirror notes of
// xintongw431-arch/webgl-runtime-cloner-skill (MIT) - no upstream code copied.
//
//   node capture_runtime_mirror.mjs --url=https://example.com/ --out=./mirror [--settle-ms=12000]
//        [--max-file-mb=128] [--max-total-mb=768] [--block=host1,host2]
//   npx http-server ./mirror/site -p 3100     # or: python3 -m http.server 3100 -d ./mirror/site
//
// Layout:  <out>/site/<same-origin path>   same-origin responses at their root-relative path
//          <out>/site/__ext/<host>/<path>  third-party responses (query hashed into filename)
//          <out>/site/index.html           entry document, URLs rewritten to local paths
//          <out>/manifest.json             url -> localPath, type, bytes (+ skipped list)
// Rules: GET 200 only (never store 206 fragments - re-fetch whole file once), skip analytics
// hosts, skip data:/blob:, cap per-file and total bytes. Uses the plugin's shared Playwright module.
// --out must be a new path or an empty real directory (never a symlink or non-empty dir).
// Local-path rewriting covers observed resources referenced by HTML src/href/srcset/poster, CSS url()/@import,
// and JS static import/export-from specifiers (relative, root-relative, absolute). Anything else
// (dynamic import(), string-built URLs, fetch() paths, <base href>) is NOT rewritten; unresolvable
// references found in those syntaxes are listed in manifest.unresolvedRefs.
import {
  mkdir,
  writeFile,
  readFile,
  lstat,
  readdir,
  realpath,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname, join, sep } from "node:path";
import { launchBrowser, settlePage } from "../../../lib/browser.mjs";

const arg = (k, d = null) => {
  const v = process.argv.slice(2).find((a) => a.startsWith(`--${k}=`));
  return v ? v.slice(k.length + 3) : d;
};
const target = arg("url");
if (!target || !/^https?:\/\//i.test(target))
  throw new Error("--url=http(s)://... required");
const outDir = resolve(arg("out", "mirror"));
const siteDir = join(outDir, "site");
const settle = Number(arg("settle-ms", "12000"));
const maxFile = Number(arg("max-file-mb", "128")) * 1024 * 1024;
const maxTotal = Number(arg("max-total-mb", "768")) * 1024 * 1024;
for (const [k, v] of [
  ["settle-ms", settle],
  ["max-file-mb", maxFile],
  ["max-total-mb", maxTotal],
]) {
  if (!Number.isFinite(v) || v < 0)
    throw new Error(`--${k} must be a non-negative number`);
}
const BLOCK = new Set([
  "www.google-analytics.com",
  "www.googletagmanager.com",
  "static.cloudflareinsights.com",
  "connect.facebook.net",
  "analytics.tiktok.com",
  "stats.g.doubleclick.net",
  ...(arg("block", "") ? arg("block").split(",") : []),
]);
const origin = new URL(target).origin;

// Output must be a fresh path or an empty real directory; never write into existing material or symlinks.
{
  let st = null;
  try {
    st = await lstat(outDir);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if (st) {
    if (st.isSymbolicLink() || !st.isDirectory())
      throw new Error(
        `--out must be a new path or an empty directory (not a symlink/file): ${outDir}`,
      );
    if ((await readdir(outDir)).length)
      throw new Error(`--out is not empty, refusing to overwrite: ${outDir}`);
  }
  await mkdir(siteDir, { recursive: true });
}
const realSite = await realpath(siteDir);

const safe = (s) => {
  let d = s;
  try {
    d = decodeURIComponent(s);
  } catch {}
  d = d.replace(/[<>:"\\/|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "");
  return !d || d === "." || d === ".." ? "_" : d;
};
function localPathFor(u) {
  const url = new URL(u);
  let path = url.pathname.endsWith("/")
    ? url.pathname + "index.html"
    : url.pathname;
  let parts = path.split("/").filter(Boolean).map(safe);
  if (!parts.length) parts = ["index.html"];
  if (url.search) {
    const h = createHash("sha1").update(url.search).digest("hex").slice(0, 10);
    const last = parts.pop();
    const dot = last.lastIndexOf(".");
    parts.push(
      dot > 0
        ? `${last.slice(0, dot)}.q${h}${last.slice(dot)}`
        : `${last}.q${h}`,
    );
  }
  return url.origin === origin
    ? parts.join("/")
    : ["__ext", safe(url.host), ...parts].join("/");
}

const usedPaths = new Map(); // localPath -> url; distinct URLs must never share a file
function allocPath(u) {
  let lp = localPathFor(u);
  if (usedPaths.has(lp) && usedPaths.get(lp) !== u) {
    const h = createHash("sha1").update(u).digest("hex").slice(0, 10);
    const parts = lp.split("/");
    const last = parts.pop();
    const dot = last.lastIndexOf(".");
    parts.push(
      dot > 0
        ? `${last.slice(0, dot)}.u${h}${last.slice(dot)}`
        : `${last}.u${h}`,
    );
    lp = parts.join("/");
  }
  usedPaths.set(lp, u);
  return lp;
}

const href = (lp) => "/" + lp.split("/").map(encodeURIComponent).join("/");
const entries = new Map(); // url -> {localPath, contentType, type, bytes}
const skipped = [];
let total = 0;
const pending = new Set();

let browser;
let finalUrl;
try {
  browser = await launchBrowser({
    headless: true,
    args: [
      "--disable-dev-shm-usage",
      "--use-gl=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  page.on("response", (res) => {
    const p = (async () => {
      const u = res.url();
      if (
        u.startsWith("data:") ||
        u.startsWith("blob:") ||
        res.request().method() !== "GET"
      )
        return;
      if (BLOCK.has(new URL(u).host))
        return skipped.push({ url: u, reason: "blocked-host" });
      if (res.status() === 206)
        return skipped.push({
          url: u,
          reason: "partial-206 (refetch full body separately)",
        });
      if (res.status() !== 200 || entries.has(u)) return;
      let body;
      try {
        body = await res.body();
      } catch {
        return skipped.push({ url: u, reason: "no-body" });
      }
      if (body.length > maxFile)
        return skipped.push({
          url: u,
          reason: "over-file-cap",
          bytes: body.length,
        });
      if (total + body.length > maxTotal)
        return skipped.push({ url: u, reason: "over-total-cap" });
      total += body.length;
      const localPath = allocPath(u);
      const file = join(siteDir, ...localPath.split("/"));
      if (!file.startsWith(siteDir + sep)) {
        total -= body.length;
        return skipped.push({ url: u, reason: "path-escape" });
      }
      try {
        await mkdir(dirname(file), { recursive: true });
        const rd = await realpath(dirname(file));
        if (rd !== realSite && !rd.startsWith(realSite + sep))
          throw Object.assign(new Error("path-escape"), {
            code: "path-escape",
          });
        await writeFile(file, body, { flag: "wx" });
      } catch (e) {
        total -= body.length;
        return skipped.push({
          url: u,
          reason: `write-failed: ${e.code || e.message}`,
        });
      }
      entries.set(u, {
        localPath,
        contentType: res.headers()["content-type"] || null,
        type: res.request().resourceType(),
        bytes: body.length,
      });
    })();
    pending.add(p);
    p.finally(() => pending.delete(p));
  });

  await page.goto(target, { waitUntil: "load", timeout: 90000 });
  await settlePage(page, { waitMs: settle, fonts: false, images: false }); // runtime loaders; do not freeze or scroll
  await Promise.all([...pending]);
  finalUrl = page.url();
} finally {
  if (browser) await browser.close();
}

// Rewrite exact absolute URLs and the source origin in text resources to local paths.
const TEXT = /^(text\/|application\/(javascript|json|xml)|image\/svg)/i;
const textFiles = [...entries.entries()].filter(
  ([u, e]) =>
    TEXT.test(e.contentType || "") ||
    /\.(html?|css|m?js|json|svg|xml)$/i.test(e.localPath),
);
const byLen = [...entries.entries()].sort((a, b) => b[0].length - a[0].length);
const unresolvedRefs = [];
const lookup = new Map([...entries].map(([u, e]) => [u, e.localPath]));
// Map one reference found in a resource fetched from `base` to its local path; null = leave untouched.
function mapRef(ref, base, strictRelative) {
  const r = ref.trim();
  if (
    !r ||
    r.startsWith("#") ||
    /^(data|blob|javascript|mailto|tel|about):/i.test(r)
  )
    return null;
  if (strictRelative && !/^(\.\.?\/|\/|https?:)/i.test(r)) return null; // bare JS specifiers are not URLs
  let url;
  try {
    url = new URL(r, base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const hash = url.hash;
  url.hash = "";
  const lp = lookup.get(url.href);
  if (lp) return href(lp) + hash;
  if (!/^https?:/i.test(r) || url.origin === origin)
    unresolvedRefs.push({ from: base, ref: r, resolved: url.href });
  return null;
}
const sub = (ref, base, strict) => mapRef(ref, base, strict) ?? ref;
const CSS_URL =
  /url\(\s*(["']?)([^"')\s][^"')]*?)\1\s*\)|@import\s+(["'])([^"']+)\3/gi;
const rewriteCss = (t, base) =>
  t.replace(CSS_URL, (m, q, u1, q2, u2) =>
    u1 !== undefined
      ? `url(${q}${sub(u1, base)}${q})`
      : `@import ${q2}${sub(u2, base)}${q2}`,
  );
const JS_STATIC =
  /\b(import|export)(\s*(?:[^'"`;()=]*?\bfrom)?\s*)(["'])([^"'\n]+)\3/g;
const rewriteJs = (t, base) =>
  t.replace(
    JS_STATIC,
    (m, k, mid, q, spec) => `${k}${mid}${q}${sub(spec, base, true)}${q}`,
  );
const rewriteHtml = (t, base) => {
  t = t.replace(
    /(\s(?:src|href|poster)\s*=\s*)(["'])([^"']*)\2/gi,
    (m, a, q, v) => `${a}${q}${sub(v, base)}${q}`,
  );
  t = t.replace(
    /(\ssrcset\s*=\s*)(["'])([^"']*)\2/gi,
    (m, a, q, v) =>
      `${a}${q}${v
        .split(",")
        .map((c) => {
          const p = c.trim().split(/\s+/);
          return [sub(p[0], base), ...p.slice(1)].join(" ");
        })
        .join(", ")}${q}`,
  );
  return t.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (m, a, css, z) => a + rewriteCss(css, base) + z,
  );
};
for (const [srcUrl, e] of textFiles) {
  const file = join(siteDir, ...e.localPath.split("/"));
  let txt = await readFile(file, "utf8");
  const kind =
    /html/i.test(e.contentType || "") || /\.html?$/i.test(e.localPath)
      ? "html"
      : /css/i.test(e.contentType || "") || /\.css$/i.test(e.localPath)
        ? "css"
        : /javascript|ecmascript/i.test(e.contentType || "") ||
            /\.m?js$/i.test(e.localPath)
          ? "js"
          : null;
  if (kind === "html") txt = rewriteHtml(txt, srcUrl);
  else if (kind === "css") txt = rewriteCss(txt, srcUrl);
  else if (kind === "js") txt = rewriteJs(txt, srcUrl);
  for (const [u, t] of byLen) txt = txt.split(u).join(href(t.localPath));
  txt = txt.split(origin + "/").join("/");
  await writeFile(file, txt);
}
const entry = [...entries.entries()].find(
  ([u]) => u === finalUrl || u === target,
);
const manifest = {
  version: 1,
  sourceUrl: target,
  finalUrl,
  entryPath: entry?.[1].localPath ?? null,
  capturedAt: new Date().toISOString(),
  totalBytes: total,
  resources: [...entries.entries()].map(([url, e]) => ({ url, ...e })),
  skipped,
  unresolvedRefs,
  note: "Runtime mirror: replays captured frontend code. Not clean-room, not editable source. Backend/auth/payment/APIs are NOT local.",
};
await writeFile(
  join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log(
  `captured ${entries.size} resources (${(total / 1048576).toFixed(1)} MiB), skipped ${skipped.length}, unresolved refs ${unresolvedRefs.length}\nserve: ${siteDir}\nmanifest: ${join(outDir, "manifest.json")}`,
);

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const script = 'skills/web-webgl/scripts/capture_runtime_mirror.mjs';
const base = await mkdtemp(join(tmpdir(), 'runtime-mirror-e2e-'));

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mirror fixture</title>
<link rel="stylesheet" href="/style.css?v=1"></head>
<body><h1 id="title">Mirror</h1><button id="go">Start</button><div id="status">idle</div>
<script src="/asset.js?v=1"></script>
<script src="/x%2f..%2f..%2fescape.js"></script>
<script src="/a%2fb.js"></script>
<script src="/a_b.js"></script>
<script type="module" src="/main.js?v=3"></script></body></html>`;
const files = {
  '/': ['text/html; charset=utf-8', html],
  '/style.css?v=1': ['text/css', '#title{color:rgb(1, 2, 3)}'],
  '/asset.js?v=1': ['text/javascript', "window.assetLoaded=true;"],
  '/x%2f..%2f..%2fescape.js': ['text/javascript', 'window.escapeLoaded=true;'],
  '/a%2fb.js': ['text/javascript', 'window.slashLoaded=true;'],
  '/a_b.js': ['text/javascript', 'window.underscoreLoaded=true;'],
  '/main.js?v=3': ['text/javascript', "import { label } from './dep.js?v=2';\ndocument.getElementById('go').onclick=()=>{document.getElementById('status').textContent=label;};"],
  '/dep.js?v=2': ['text/javascript', "export const label = 'clicked';"],
};
const origin = createServer((req, res) => {
  const hit = files[req.url];
  if (!hit) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': hit[0] });
  res.end(hit[1]);
});
await new Promise((r) => origin.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${origin.address().port}/`;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
async function serveDir(dir) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = resolve(dir, '.' + path);
      if (file !== dir && !file.startsWith(dir + sep)) throw new Error('outside');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nf'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return server;
}

async function exercise(pageUrl, browser) {
  const page = await browser.newPage();
  const failed = [];
  page.on('response', (r) => { if (r.status() >= 400) failed.push(r.url()); });
  await page.goto(pageUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => window.assetLoaded && window.slashLoaded && window.underscoreLoaded);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('title')).color), 'rgb(1, 2, 3)');
  await page.click('#go');
  await page.waitForFunction(() => document.getElementById('status').textContent === 'clicked');
  await page.close();
  return failed;
}

const { chromium } = await import('playwright');
let browser;
let mirror;
try {
  browser = await chromium.launch();
  assert.deepEqual(await exercise(url, browser), []);

  const out = join(base, 'out');
  await exec('node', [script, `--url=${url}`, `--out=${out}`, '--settle-ms=300'], { cwd: root, timeout: 120000 });

  // Percent-encoded traversal must not create files outside <out>/site.
  assert.deepEqual((await readdir(base)).sort(), ['out']);
  assert.deepEqual((await readdir(out)).sort(), ['manifest.json', 'site']);
  const manifest = JSON.parse(await readFile(join(out, 'manifest.json'), 'utf8'));
  const paths = manifest.resources.map((r) => r.localPath);
  assert.equal(new Set(paths).size, paths.length, 'localPath collision');
  for (const p of paths) assert.ok(!p.split('/').includes('..'), p);
  assert.ok(manifest.resources.some((r) => r.url.endsWith('/a%2fb.js')) && manifest.resources.some((r) => r.url.endsWith('/a_b.js')));
  const indexHtml = await readFile(join(out, 'site', 'index.html'), 'utf8');
  assert.ok(!/asset\.js\?v=1/.test(indexHtml), 'query URL not rewritten');

  // Replay without the origin server.
  origin.closeAllConnections();
  await new Promise((r) => origin.close(r));
  mirror = await serveDir(join(out, 'site'));
  assert.deepEqual(await exercise(`http://127.0.0.1:${mirror.address().port}/`, browser), []);

  // Existing non-empty output, symlink output: refused and untouched.
  const keep = join(base, 'keep');
  await mkdir(keep);
  await writeFile(join(keep, 'mine.txt'), 'mine');
  await assert.rejects(exec('node', [script, `--url=${url}`, `--out=${keep}`, '--settle-ms=0'], { cwd: root, timeout: 60000 }), /not empty/);
  assert.deepEqual(await readdir(keep), ['mine.txt']);
  const link = join(base, 'link');
  await symlink(keep, link);
  await assert.rejects(exec('node', [script, `--url=${url}`, `--out=${link}`, '--settle-ms=0'], { cwd: root, timeout: 60000 }), /symlink/);
  assert.deepEqual(await readdir(keep), ['mine.txt']);
  await assert.rejects(exec('node', [script, `--url=${url}`, `--out=${out}`, '--settle-ms=0'], { cwd: root, timeout: 60000 }), /not empty/);
  console.log('runtime mirror e2e passed');
} finally {
  if (browser) await browser.close();
  if (mirror) mirror.closeAllConnections();
  if (mirror) await new Promise((r) => mirror.close(r));
  if (origin.listening) await new Promise((r) => origin.close(r));
  await rm(base, { recursive: true, force: true });
}

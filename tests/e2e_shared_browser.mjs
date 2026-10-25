// Run from the plugin root:  node tests/e2e_shared_browser.mjs
// Real Chromium against a local http server; exercises lib/browser.mjs through its consumers.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { launchBrowser, settlePage, freezeMotion } from "../lib/browser.mjs";

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const shot = join(root, "skills/shot-compare-iterate/scripts/shot.mjs");
const qa = join(
  root,
  "skills/shot-compare-iterate/scripts/capture_visual_qa.mjs",
);
const rn = join(root, "skills/shot-to-rn/scripts/rn-verify.mjs");
const runtime = join(root, "skills/web-webgl/scripts/runtime-qa.mjs");
const output = await mkdtemp(join(tmpdir(), "shared-browser-e2e-"));
const PNG1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let hangOpen = 0;
let hangClosed = 0;
const server = createServer((req, res) => {
  if (req.url === "/frame") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end('<!doctype html><iframe src="/canvas"></iframe>');
    return;
  }
  if (req.url === "/ok.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(PNG1);
    return;
  }
  if (req.url === "/hang.png") {
    hangOpen += 1;
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": String(PNG1.length),
    });
    res.write(PNG1.subarray(0, 8)); // headers and a partial body, then never finish
    res.on("close", () => {
      hangClosed += 1;
    });
    return;
  }
  const hang = req.url.startsWith("/hang");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fixture</title>
<style>body{margin:0;background:#123456;color:#fff}button{cursor:pointer}button:hover{background:#c33}button:focus-visible{outline:2px solid #fff}
#spin{width:20px;height:20px;background:#0f0;animation:slide 5s linear infinite}@keyframes slide{from{margin-left:0}to{margin-left:100px}}</style></head>
<body><h1>Shared browser</h1><div id="spin"></div><img src="/ok.png" width="10" height="10">${hang ? '<img src="/hang.png" width="10" height="10">' : ""}
<button>Start</button><input id="t" value="x">${req.url === "/canvas" ? '<canvas width="100" height="60"></canvas>' : ""}${req.url === "/errors" ? '<script>console.error("expected fixture error")</script>' : ""}</body></html>`);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

async function run(args, { cwd = root, expect = 0 } = {}) {
  try {
    const r = await exec("node", args, { cwd, timeout: 90000 });
    assert.equal(expect, 0, `expected exit ${expect}: ${args.join(" ")}`);
    return { code: 0, stdout: r.stdout, stderr: r.stderr };
  } catch (e) {
    if (e.code === expect && expect !== 0)
      return { code: e.code, stdout: e.stdout, stderr: e.stderr };
    throw e;
  }
}
const until = async (cond, ms) => {
  const end = Date.now() + ms;
  while (!cond()) {
    assert.ok(Date.now() < end, "condition not met in time");
    await new Promise((r) => setTimeout(r, 50));
  }
};
const dims = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

try {
  // 1. default capture through shot.mjs: bundled Chromium, DPR, viewport-only
  const png = join(output, "default.png");
  const r1 = await run([
    shot,
    "--url",
    `${base}/`,
    "--out",
    png,
    "--width",
    "400",
    "--height",
    "300",
    "--scale",
    "2",
    "--viewport-only",
    "--wait",
    "0",
  ]);
  assert.match(r1.stdout, /\[shot\] saved/);
  const b1 = await readFile(png);
  assert.deepEqual(b1.subarray(0, 8), PNG_SIG);
  assert.deepEqual(dims(b1), { w: 800, h: 600 });

  // 2. states and verify
  const st = join(output, "state.png");
  const r2 = await run([
    shot,
    "--url",
    `${base}/`,
    "--out",
    st,
    "--states",
    "--wait",
    "0",
  ]);
  assert.match(r2.stdout, /states saved/);
  assert.ok(
    existsSync(join(output, "state-hover.png")) &&
      existsSync(join(output, "state-focus.png")),
  );
  const r3 = await run([shot, "--url", `${base}/`, "--verify", "--wait", "0"]);
  assert.match(r3.stdout, /interactive elements : \d+/);
  assert.match(r3.stdout, /:hover rules\s+: 1/);
  assert.ok(!existsSync(join(output, "verify.png")));
  const r3b = await run([
    shot,
    "--url",
    `${base}/`,
    "--out",
    join(output, "click.png"),
    "--click",
    "button",
    "--wait",
    "0",
  ]);
  assert.match(r3b.stdout, /saved/);
  // --channel is explicit: an uninstalled channel is a launch error (exit 3), not a fallback
  const bad = await run(
    [
      shot,
      "--url",
      `${base}/`,
      "--out",
      join(output, "nochan.png"),
      "--channel",
      "definitely-not-a-channel",
    ],
    { expect: 3 },
  );
  assert.match(bad.stderr, /could not launch a browser/);
  assert.ok(!existsSync(join(output, "nochan.png")));

  // 3. named viewport QA JSON
  const qaDir = join(output, "qa");
  const r4 = await run([
    qa,
    "--url",
    `${base}/`,
    "--out",
    qaDir,
    "--viewport",
    "phone:320x240",
    "--viewport",
    "tablet:500x400",
    "--wait",
    "0",
  ]);
  const summary = JSON.parse(r4.stdout);
  assert.equal(summary.valid, true);
  assert.equal(summary.reduce_motion, true);
  assert.deepEqual(
    summary.screenshots.map((s) => s.name),
    ["desktop", "tablet", "mobile", "phone"],
  );
  assert.equal(summary.screenshots.find((s) => s.name === "tablet").width, 500);
  for (const s of summary.screenshots) {
    assert.deepEqual((await readFile(s.file)).subarray(0, 8), PNG_SIG);
  }
  assert.equal(dims(await readFile(join(qaDir, "phone.png"))).w, 320);
  assert.equal(
    JSON.parse(
      await readFile(join(qaDir, "visual-qa-capture-summary.json"), "utf8"),
    ).tool,
    "capture_visual_qa",
  );

  // 4. incomplete image: explicit timeout error, both direct and via CLIs; browser torn down afterwards
  {
    const browser = await launchBrowser({ headless: true });
    try {
      const page = await browser.newPage();
      await assert.rejects(
        settlePage(page, { timeoutMs: 0, fonts: false, images: false }),
        /positive/,
      );
      await page.goto(`${base}/hang`, { waitUntil: "domcontentloaded" });
      const t0 = Date.now();
      await assert.rejects(
        settlePage(page, { timeoutMs: 1000 }),
        /not settled within 1000ms: image:.*hang\.png/,
      );
      assert.ok(Date.now() - t0 < 5000, "settlePage must honour its limit");
      await settlePage(page, { timeoutMs: 1000, images: false }); // not asked to wait for images
    } finally {
      await browser.close();
    }
    assert.equal(browser.isConnected(), false);
  }
  await until(() => hangClosed === hangOpen, 10000); // direct-run connection fully released
  let closedBefore = hangClosed;
  const r5 = await run(
    [
      shot,
      "--url",
      `${base}/hang`,
      "--out",
      join(output, "hang.png"),
      "--timeout",
      "1000",
      "--wait",
      "0",
    ],
    { expect: 1 },
  );
  assert.match(r5.stderr, /not settled within 1000ms: image:.*hang\.png/);
  assert.ok(!existsSync(join(output, "hang.png")));
  await until(() => hangClosed > closedBefore, 10000); // browser closed -> server sees the connection drop
  await until(() => hangClosed === hangOpen, 10000);
  closedBefore = hangClosed;
  const r6 = await run(
    [
      qa,
      "--url",
      `${base}/hang`,
      "--out",
      join(output, "qahang"),
      "--timeout",
      "1000",
      "--wait",
      "0",
    ],
    { expect: 1 },
  );
  assert.equal(JSON.parse(r6.stderr).valid, false);
  assert.match(JSON.parse(r6.stderr).error, /not settled/);
  await until(() => hangClosed > closedBefore, 10000);

  // 5. stop vs finish motion
  {
    const browser = await launchBrowser({ headless: true });
    try {
      const probe = async (mode) => {
        const page = await browser.newPage();
        await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
        await freezeMotion(page, { mode });
        await freezeMotion(page, { mode }); // idempotent
        await settlePage(page, { timeoutMs: 5000 });
        const v = await page.evaluate(() => {
          const cs = getComputedStyle(document.getElementById("spin"));
          return {
            name: cs.animationName,
            dur: cs.animationDuration,
            iter: cs.animationIterationCount,
            caret: getComputedStyle(document.getElementById("t")).caretColor,
          };
        });
        await page.close();
        return v;
      };
      const stop = await probe("stop");
      assert.equal(stop.name, "none");
      assert.equal(stop.caret, "rgba(0, 0, 0, 0)");
      const fin = await probe("finish");
      assert.equal(fin.name, "slide");
      assert.equal(fin.dur, "0.001s");
      assert.equal(fin.iter, "1");
      const page = await browser.newPage();
      await assert.rejects(
        freezeMotion(page, { mode: "bogus" }),
        /unknown mode/,
      );
    } finally {
      await browser.close();
    }
  }

  // 6. mobile routes and user flows keep their own gate semantics.
  const flowFile = join(output, "flows.mjs");
  await writeFile(
    flowFile,
    `export const flows = [{name:'reload persists',run:async(page,base)=>{
    await page.goto(base); await page.evaluate(()=>localStorage.setItem('probe','yes'));
    await page.reload(); if(await page.evaluate(()=>localStorage.getItem('probe')) !== 'yes') throw Error('lost');
  }}];`,
  );
  const mobile = await run(
    [
      rn,
      "--base",
      base,
      "--routes",
      "/",
      "/canvas",
      "--out",
      join(output, "rn"),
      "--width",
      "320",
      "--height",
      "240",
      "--scale",
      "1",
      "--wait",
      "0",
      "--flows",
      flowFile,
    ],
    { cwd: output },
  );
  assert.match(mobile.stdout, /flow PASS: reload persists/);
  assert.match(mobile.stdout, /ALL PASS/);
  assert.equal(dims(await readFile(join(output, "rn/index.png"))).w, 320);
  const mobileError = await run(
    [
      rn,
      "--base",
      base,
      "--routes",
      "/errors",
      "--out",
      join(output, "rn-errors"),
      "--wait",
      "0",
    ],
    { expect: 1 },
  );
  assert.match(mobileError.stderr, /expected fixture error/);
  await writeFile(
    flowFile,
    `export const flows=[{name:'failed flow',run:async()=>{throw Error('flow failure')}}];`,
  );
  const failedFlow = await run(
    [
      rn,
      "--base",
      base,
      "--out",
      join(output, "rn-flow"),
      "--flows",
      flowFile,
      "--wait",
      "0",
    ],
    { expect: 1 },
  );
  assert.match(failedFlow.stderr, /flow failure/);

  // 7. WebGL QA retains iframe selection and canvas assertions, without freezing the runtime.
  const runtimePass = await run(
    [
      runtime,
      `--url=${base}/frame`,
      `--out=${join(output, "runtime")}`,
      "--viewports=320x240",
      "--settle-ms=0",
    ],
    { cwd: output },
  );
  const runtimeReport = JSON.parse(runtimePass.stdout);
  assert.equal(runtimeReport.viewports["320x240"].state.canvasCount, 1);
  assert.ok(Object.values(runtimeReport.assertions).every(Boolean));
  const runtimeFail = await run(
    [
      runtime,
      `--url=${base}/`,
      `--out=${join(output, "runtime-fail")}`,
      "--viewports=320x240",
      "--settle-ms=0",
    ],
    { expect: 1 },
  );
  assert.equal(JSON.parse(runtimeFail.stdout).assertions.canvasPresent, false);

  // 8. module loads from another cwd
  const other = await mkdtemp(join(tmpdir(), "shared-browser-cwd-"));
  try {
    await writeFile(
      join(other, "probe.mjs"),
      `import(${JSON.stringify(pathToFileURL(join(root, "lib/browser.mjs")).href)}).then(async (m) => {
  if (typeof m.launchBrowser !== 'function' || typeof m.settlePage !== 'function' || typeof m.freezeMotion !== 'function') throw new Error('missing exports');
  const b = await m.launchBrowser({ headless: true }); await b.close(); console.log('ok');
});`,
    );
    const r7 = await run([join(other, "probe.mjs")], { cwd: other });
    assert.equal(r7.stdout.trim(), "ok");
    const r8 = await run(
      [
        shot,
        "--in",
        join(output, "missing.html"),
        "--out",
        join(output, "x.png"),
      ],
      { cwd: other, expect: 2 },
    );
    assert.match(r8.stderr, /input not found/);
  } finally {
    await rm(other, { recursive: true, force: true });
  }
  console.log("shared browser e2e ok");
} finally {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await rm(output, { recursive: true, force: true });
}

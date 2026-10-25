#!/usr/bin/env node
// Capture a breakpoint matrix (top + full screenshots + runtime health) for ONE url.
// Run once for the reference and once for the replica with the same flags, then pixel_diff.py.
// Original implementation. Uses the plugin's shared Playwright installation
// (npm i -D playwright && npx playwright install chromium).
//
//   node capture_matrix.mjs --url=https://ref.example/ --out=./clone/reference --prefix=site
//   node capture_matrix.mjs --url=http://127.0.0.1:5180/ --out=./clone/replica --prefix=site
// Flags: --viewports=1920x1000,1440x1000,1024x1000,768x1000,375x812  --settle-ms=2500
//        --freeze=1 (default: kill CSS animation/transition, pause video at t=0, hide caret)
//        --prime=1  (default: scroll through page once to trigger lazy/reveal content)
//        --user-agent=...  --storage-state=path.json (only for sessions the user supplied)
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  launchBrowser,
  settlePage,
  freezeMotion,
} from "../../../lib/browser.mjs";

const arg = (k, d = null) => {
  const p = `--${k}=`;
  const v = process.argv.slice(2).find((a) => a.startsWith(p));
  return v ? v.slice(p.length) : d;
};
const url = arg("url");
if (!url) throw new Error("--url is required");
if (!/^https?:\/\//i.test(url))
  throw new Error("only http(s) URLs are allowed");
const out = resolve(arg("out", "capture"));
const prefix = arg("prefix", "site");
const settle = Number(arg("settle-ms", "2500"));
if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(prefix))
  throw new Error("prefix must be a filename component");
if (!Number.isFinite(settle) || settle < 0 || settle > 60000)
  throw new Error("settle-ms must be 0..60000");
const freeze = arg("freeze", "1") !== "0";
const prime = arg("prime", "1") !== "0";
const viewports = arg(
  "viewports",
  "1920x1000,1440x1000,1024x1000,768x1000,375x812",
)
  .split(",")
  .map((s) => {
    const m = /^(\d+)x(\d+)$/.exec(s.trim());
    if (!m || +m[1] < 1 || +m[2] < 1 || +m[1] > 16384 || +m[2] > 16384)
      throw new Error(`bad viewport ${s}`);
    return { width: +m[1], height: +m[2] };
  });

await mkdir(out, { recursive: true });

const browser = await launchBrowser({
  headless: true,
  args: ["--disable-dev-shm-usage", "--font-render-hinting=none"],
});
const summary = {};
try {
  for (const vp of viewports) {
    const key = `${vp.width}x${vp.height}`;
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: 1,
      userAgent: arg("user-agent") || undefined,
      storageState: arg("storage-state") || undefined,
    });
    const page = await ctx.newPage();
    const consoleErrors = [],
      pageErrors = [],
      httpErrors = [];
    page.on(
      "console",
      (m) => m.type() === "error" && consoleErrors.push(m.text()),
    );
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on(
      "response",
      (r) =>
        r.status() >= 400 &&
        httpErrors.push({ status: r.status(), url: r.url() }),
    );
    await page.goto(url, { waitUntil: "load", timeout: 60000 });
    await settlePage(page, { waitMs: settle, fonts: false, images: false });
    if (prime) {
      await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const step = Math.max(200, Math.round(innerHeight * 0.6));
        const deadline = Date.now() + 30000;
        for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
          if (Date.now() > deadline)
            throw new Error("lazy-content priming exceeded 30 seconds");
          scrollTo(0, y);
          await sleep(250);
        }
        scrollTo(0, 0);
        await sleep(400);
      });
      await settlePage(page, { fonts: true, images: false });
    }
    if (freeze) {
      await freezeMotion(page, { mode: "stop" });
      await page.evaluate(async () => {
        await Promise.all(
          [...document.querySelectorAll("video")].map(
            (v) =>
              new Promise((res) => {
                v.pause();
                v.muted = true;
                v.addEventListener("seeked", res, { once: true });
                try {
                  v.currentTime = 0;
                } catch {
                  res();
                }
                setTimeout(res, 1200);
              }),
          ),
        );
      });
      await page.waitForTimeout(300);
    }
    const health = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        title: document.title,
        finalUrl: location.href,
        scrollHeight: de.scrollHeight,
        horizontalOverflow: de.scrollWidth > innerWidth,
        badImages: [...document.images]
          .filter((i) => !(i.complete && i.naturalWidth > 0))
          .map((i) => i.currentSrc || i.src),
        videos: [...document.querySelectorAll("video")].map((v) => ({
          src: v.currentSrc,
          readyState: v.readyState,
          t: v.currentTime,
        })),
        canvases: [...document.querySelectorAll("canvas")].map((c) => {
          const r = c.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        }),
        fonts: document.fonts
          ? [...document.fonts]
              .filter((f) => f.status === "loaded")
              .map((f) => `${f.family} ${f.weight}`)
          : [],
      };
    });
    await page.screenshot({
      path: resolve(out, `${prefix}-${key}-top.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: resolve(out, `${prefix}-${key}-full.png`),
      fullPage: true,
    });
    summary[key] = { ...health, consoleErrors, pageErrors, httpErrors };
    await ctx.close();
  }
} finally {
  await browser.close();
}
const file = resolve(out, `${prefix}-runtime.json`);
await writeFile(
  file,
  JSON.stringify(
    { url, capturedAt: new Date().toISOString(), freeze, viewports: summary },
    null,
    2,
  ),
);
console.log(
  `wrote ${Object.keys(summary).length} viewports to ${out}\nruntime: ${file}`,
);

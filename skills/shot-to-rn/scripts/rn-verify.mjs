#!/usr/bin/env node
/*
 * rn-verify.mjs - original helper for the shot-* skills (not copied from upstream).
 *
 * Functional gate for an Expo / React Native app rendered on WEB (expo start --web, or a served
 * `expo export --platform web` folder). A screenshot proves a screen RENDERED; this proves it RUNS:
 *   1. every route loads in an emulated phone with zero pageerror / console.error,
 *   2. no horizontal overflow (scrollWidth <= innerWidth),
 *   3. optional user flows (add / edit / delete / reload-persists) pass,
 *   4. one screenshot per route is saved for shot-compare-iterate.
 *
 * Uses the plugin's Playwright installation and bundled Chromium. --channel chrome explicitly selects installed Chrome.
 *
 * Usage:
 *   node rn-verify.mjs --base http://localhost:8081 --routes / /search /profile --out tmp/shot/rn
 *                      [--width 390 --height 844 --scale 2 --flows e2e/flows.mjs --wait 800]
 *
 * flows.mjs shape:
 *   export const flows = [{ name: 'add item persists', run: async (page, base) => { ... throw on failure } }];
 * Exit code 0 = all pass, 1 = any failure, 2 = usage/launch error.
 */
import { launchBrowser, settlePage } from "../../../lib/browser.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parse(argv) {
  const a = {
    routes: ["/"],
    width: 390,
    height: 844,
    scale: 2,
    wait: 800,
    out: "tmp/shot/rn",
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--base") a.base = argv[++i];
    else if (k === "--routes") {
      a.routes = [];
      while (argv[i + 1] && !argv[i + 1].startsWith("--"))
        a.routes.push(argv[++i]);
    } else if (k === "--out") a.out = argv[++i];
    else if (k === "--width") a.width = parseInt(argv[++i], 10);
    else if (k === "--height") a.height = parseInt(argv[++i], 10);
    else if (k === "--scale") a.scale = parseFloat(argv[++i]);
    else if (k === "--wait") a.wait = parseInt(argv[++i], 10);
    else if (k === "--flows") a.flows = argv[++i];
    else if (k === "--channel") a.channel = argv[++i];
  }
  return a;
}
const A = parse(process.argv.slice(2));
if (!A.base) {
  console.error(
    "usage: node rn-verify.mjs --base <url> [--routes /a /b] [--flows file.mjs] [--out dir]",
  );
  process.exit(2);
}
mkdirSync(A.out, { recursive: true });

let browser;
try {
  browser = await launchBrowser({
    headless: true,
    ...(A.channel ? { channel: A.channel } : {}),
  });
} catch (e) {
  console.error("[rn-verify] no browser:", e.message);
  process.exit(2);
}

const failures = [];
try {
  const ctx = await browser.newContext({
    viewport: { width: A.width, height: A.height },
    deviceScaleFactor: A.scale,
    isMobile: true,
    hasTouch: true,
  });
  const attach = (page, label) => {
    page.on("pageerror", (e) =>
      failures.push(`${label}: pageerror ${e.message}`),
    );
    page.on("console", (m) => {
      if (m.type() === "error")
        failures.push(`${label}: console.error ${m.text()}`);
    });
  };

  for (const route of A.routes) {
    const page = await ctx.newPage();
    attach(page, route);
    await page
      .goto(new URL(route, A.base).href, { waitUntil: "domcontentloaded" })
      .catch((e) => failures.push(`${route}: goto ${e.message}`));
    await settlePage(page, {
      waitMs: A.wait,
      fonts: true,
      images: false,
    }).catch((e) => failures.push(`${route}: settle ${e.message}`));
    const m = await page.evaluate(() => ({
      inner: innerWidth,
      scroll: document.documentElement.scrollWidth,
      dpr: devicePixelRatio,
    }));
    if (m.inner !== A.width)
      failures.push(
        `${route}: innerWidth ${m.inner} != requested ${A.width} (missing <meta name="viewport" content="width=device-width">?) - screenshot is not at the target width`,
      );
    if (m.scroll > m.inner)
      failures.push(
        `${route}: horizontal overflow scrollWidth ${m.scroll} > innerWidth ${m.inner}`,
      );
    const file = path.join(
      A.out,
      (route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "index") +
        ".png",
    );
    await page.screenshot({ path: file, fullPage: true });
    console.log(
      `[rn-verify] ${route} innerWidth=${m.inner} dpr=${m.dpr} -> ${file}`,
    );
    await page.close();
  }

  if (A.flows) {
    const { flows } = await import(pathToFileURL(path.resolve(A.flows)).href);
    for (const f of flows) {
      const page = await ctx.newPage();
      attach(page, `flow "${f.name}"`);
      try {
        await f.run(page, A.base);
        console.log(`[rn-verify] flow PASS: ${f.name}`);
      } catch (e) {
        failures.push(`flow "${f.name}": ${e.message}`);
        console.log(`[rn-verify] flow FAIL: ${f.name}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error("[rn-verify] FAIL\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log("[rn-verify] ALL PASS");

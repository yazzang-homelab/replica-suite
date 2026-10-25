// Copied from xintongw431-arch/webgl-runtime-cloner-skill (scripts/runtime-qa.mjs),
// commit 93d025b, MIT License (c) its authors. Modified: shared browser launch/settling and guaranteed cleanup.
// Uses the plugin's Playwright installation; paths are resolved from the caller's directory.
// Usage: node runtime-qa.mjs --url=http://127.0.0.1:3100/ --out=./qa --viewports=375x812,768x1024,1280x800,1920x1080
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { launchBrowser, settlePage } from "../../../lib/browser.mjs";

function readArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((entry) => entry.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const targetUrl = readArg("url");
const outputDir = resolve(readArg("out", "runtime-qa"));
const settleMs = Number(readArg("settle-ms", "12000"));
const viewportSpec = readArg(
  "viewports",
  "375x812,768x1024,1280x800,1920x1080",
);

if (!targetUrl) {
  throw new Error("Pass --url=http://127.0.0.1:PORT/");
}

const viewports = viewportSpec.split(",").map((entry) => {
  const match = /^(\d+)x(\d+)$/.exec(entry.trim());
  if (!match) throw new Error(`Invalid viewport: ${entry}`);
  return { width: Number(match[1]), height: Number(match[2]) };
});

await mkdir(outputDir, { recursive: true });

const browser = await launchBrowser({
  headless: true,
  args: ["--disable-dev-shm-usage"],
});
const report = {
  targetUrl,
  capturedAt: new Date().toISOString(),
  viewports: {},
  assertions: {},
};

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const httpErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        httpErrors.push({ status: response.status(), url: response.url() });
      }
    });

    await page.goto(targetUrl, { waitUntil: "load", timeout: 60_000 });
    await settlePage(page, { waitMs: settleMs, fonts: false, images: false });
    const runtimeFrame =
      page.frames().find((candidate) => candidate !== page.mainFrame()) ??
      page.mainFrame();
    const state = await runtimeFrame.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("canvas"));
      const largest = canvases
        .map((canvas) => ({ canvas, rect: canvas.getBoundingClientRect() }))
        .sort(
          (a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height,
        )[0];
      return {
        title: document.title,
        url: location.href,
        canvasCount: canvases.length,
        canvasEngine: largest?.canvas.getAttribute("data-engine") ?? null,
        largestCanvas: largest
          ? { width: largest.rect.width, height: largest.rect.height }
          : null,
        scrollHeight: document.documentElement.scrollHeight,
        resourceCount: performance.getEntriesByType("resource").length,
      };
    });

    const key = `${viewport.width}x${viewport.height}`;
    await page.screenshot({
      path: resolve(outputDir, `${key}.png`),
      fullPage: false,
    });
    report.viewports[key] = {
      state,
      pageErrors,
      consoleErrors,
      httpErrors,
    };
    await context.close();
  }
} finally {
  await browser.close();
}
const results = Object.values(report.viewports);
report.assertions = {
  noPageErrors: results.every((entry) => entry.pageErrors.length === 0),
  noConsoleErrors: results.every((entry) => entry.consoleErrors.length === 0),
  noHttpErrors: results.every((entry) => entry.httpErrors.length === 0),
  canvasPresent: results.every((entry) => entry.state.canvasCount > 0),
  canvasHasArea: results.every(
    (entry) =>
      Number(entry.state.largestCanvas?.width ?? 0) > 0 &&
      Number(entry.state.largestCanvas?.height ?? 0) > 0,
  ),
};

await writeFile(
  resolve(outputDir, "runtime-qa.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

if (!Object.values(report.assertions).every(Boolean)) {
  process.exitCode = 1;
}

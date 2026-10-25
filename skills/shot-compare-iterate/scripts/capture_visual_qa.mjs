#!/usr/bin/env node
/*
 * Credit: copied from vishnu-madhavan-git/9designer-skills (skills/9assets-website/scripts/capture_visual_qa.mjs),
 * commit b9b9289feec3bdfa42799a136623d163460d2fd8, Apache License 2.0 (see upstream LICENSE).
 * Change notice: modified by this plugin. Browser launch, bounded font/image settling and the finish-animation
 * stabilization now use the shared lib/browser.mjs instead of a local optional-Playwright loader and
 * networkidle wait; the browser is always closed in a finally block; --timeout was added.
 */
/**
 * Capture stable desktop/tablet/mobile screenshots for 9Designer website QA.
 *
 * Uses the plugin's Playwright (bundled Chromium) through lib/browser.mjs. Animations are finished,
 * not stopped: see freezeMotion mode "finish".
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  launchBrowser,
  settlePage,
  freezeMotion,
} from "../../../lib/browser.mjs";

const DEFAULT_VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

function usage() {
  console.log(`Usage:
  node capture_visual_qa.mjs --url <local-url> [options]

Options:
  --url <url>                Website URL to capture. Required.
  --out <dir>                Output directory. Default: visual-qa/screenshots
  --viewport <n:wxh>         Add/replace a viewport, e.g. desktop:1440x1100
  --wait <ms>                Extra wait after fonts/images settle. Default: 600
  --timeout <ms>             Limit for page load and font/image settling; exceeding it is an error. Default: 15000
  --viewport-only            Capture only the visible viewport instead of full page
  --keep-animations          Do not finish animations (no reduced-motion CSS)
  --help                     Show this help

Requires the plugin dependencies (npm install) and:
  npx playwright install chromium`);
}

function parseArgs(argv) {
  const args = {
    url: "",
    out: "visual-qa/screenshots",
    viewports: [],
    wait: 600,
    timeout: 15000,
    fullPage: true,
    reduceMotion: true,
    help: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      args.help = true;
    } else if (value === "--url") {
      args.url = argv[++index] || "";
    } else if (value === "--out") {
      args.out = argv[++index] || args.out;
    } else if (value === "--viewport") {
      args.viewports.push(argv[++index] || "");
    } else if (value === "--wait") {
      args.wait = Number(argv[++index] || args.wait);
    } else if (value === "--timeout") {
      args.timeout = Number(argv[++index] || args.timeout);
    } else if (value === "--viewport-only") {
      args.fullPage = false;
    } else if (value === "--keep-animations") {
      args.reduceMotion = false;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function parseViewport(value) {
  const match = /^([a-z0-9_-]+):(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    throw new Error(`Invalid viewport "${value}". Use name:widthxheight.`);
  }
  return {
    name: match[1].toLowerCase(),
    width: Number(match[2]),
    height: Number(match[3]),
  };
}

function mergeViewports(values) {
  if (!values.length) {
    return DEFAULT_VIEWPORTS;
  }

  const byName = new Map(
    DEFAULT_VIEWPORTS.map((viewport) => [viewport.name, viewport]),
  );
  for (const value of values) {
    const viewport = parseViewport(value);
    byName.set(viewport.name, viewport);
  }
  return Array.from(byName.values());
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.url) {
    usage();
    process.exit(1);
  }

  const outDir = path.resolve(args.out);
  await mkdir(outDir, { recursive: true });

  const browser = await launchBrowser({ headless: true });
  const screenshots = [];
  const consoleMessages = [];

  try {
    for (const viewport of mergeViewports(args.viewports)) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          consoleMessages.push({
            viewport: viewport.name,
            type: message.type(),
            text: message.text(),
          });
        }
      });

      await page.goto(args.url, { waitUntil: "domcontentloaded" });
      if (args.reduceMotion) {
        await freezeMotion(page, { mode: "finish" });
      }
      await settlePage(page, { timeoutMs: args.timeout, waitMs: args.wait });

      const file = path.join(outDir, `${viewport.name}.png`);
      await page.screenshot({ path: file, fullPage: args.fullPage });
      screenshots.push({ ...viewport, file });
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const summary = {
    valid: true,
    tool: "capture_visual_qa",
    url: args.url,
    output_dir: outDir,
    full_page: args.fullPage,
    reduce_motion: args.reduceMotion,
    screenshots,
    console_messages: consoleMessages,
  };
  await writeFile(
    path.join(outDir, "visual-qa-capture-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      { valid: false, error: error?.message || String(error) },
      null,
      2,
    ),
  );
  process.exit(1);
});

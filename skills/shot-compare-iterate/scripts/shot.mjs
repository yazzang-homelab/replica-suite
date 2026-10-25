#!/usr/bin/env node
/*
 * Credit: copied from sevzq/screenshot-to-html (scripts/shot.mjs), commit 7b5469b2c2c95091f4c2e87f125b19f644f9aff0, MIT License, Copyright (c) 2026 SevenZhang.
 * Change notice: modified by this plugin. Browser launch, font/image settling and animation freezing now use the
 * shared lib/browser.mjs (bundled Chromium by default; Chrome only via explicit --channel; no hidden fallback;
 * bounded waits instead of networkidle). Help text updated accordingly.
 */
/*
 * shot.mjs — Render a local HTML file or URL with Playwright Chromium and save a screenshot.
 *
 * The render→screenshot step of the screenshot-to-html "rendered-state" loop, plus an
 * interaction audit (--verify) and state captures (--hover/--focus/--click/--states).
 * Uses the plugin's Playwright (via lib/browser.mjs) with the bundled Chromium.
 * Pass --channel chrome to drive an installed Google Chrome instead; there is no automatic fallback.
 *
 * Install once:   npm install   (plugin root), then  npx playwright install chromium
 *
 * Usage:
 *   node scripts/shot.mjs --in replica.html --out tmp/screenshot-to-html/v1.png --width 1280
 *   node scripts/shot.mjs --in replica.html --verify            # interaction/affordance audit
 *   node scripts/shot.mjs --in replica.html --out s.png --hover '.cta'   # capture a hover state
 *   node scripts/shot.mjs --in replica.html --out s.png --click '#tab-2' # click, then capture
 *   node scripts/shot.mjs --in replica.html --out s.png --states         # base + -hover + -focus
 *
 * Options:
 *   --in <file>        local HTML file to render
 *   --url <url>        URL to render (use instead of --in)
 *   --out <file>       output PNG path (required unless --verify)
 *   --width <px>       viewport width (default 1280) — match the target image's design width
 *   --height <px>      viewport height (default 900); ignored unless --viewport-only
 *   --full             full-page capture (default ON)
 *   --viewport-only    capture only the viewport (above the fold)
 *   --scale <n>        deviceScaleFactor (default 2 for crisp diffs; use 1 for exact-pixel overlay)
 *   --still            stop CSS animations/transitions and hide the caret for a stable frame (default ON)
 *   --motion           keep animations running
 *   --wait <ms>        extra settle time after load (default 400)
 *   --timeout <ms>     limit for page load and font/image settling (default 15000); exceeding it is an error
 *   --channel <name>   browser channel, e.g. chrome or msedge (default: bundled Chromium)
 *   --verify           audit interactivity (dead controls, cursor, :hover/:focus rules); no screenshot
 *   --hover <sel>      hover this selector before the screenshot (capture :hover state)
 *   --focus <sel>      focus this selector before the screenshot (capture :focus state)
 *   --click <sel>      click this selector before the screenshot (open a modal / switch a tab)
 *   --states           also save <out>-hover and <out>-focus for the primary control
 */
import {
  launchBrowser,
  settlePage,
  freezeMotion,
} from "../../../lib/browser.mjs";
import { pathToFileURL } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const a = {
    width: 1280,
    height: 900,
    scale: 2,
    full: true,
    still: true,
    wait: 400,
    timeout: 15000,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = () => argv[++i];
    if (flag === "--in") a.in = val();
    else if (flag === "--url") a.url = val();
    else if (flag === "--out") a.out = val();
    else if (flag === "--width") a.width = parseInt(val(), 10);
    else if (flag === "--height") a.height = parseInt(val(), 10);
    else if (flag === "--scale") a.scale = parseFloat(val());
    else if (flag === "--wait") a.wait = parseInt(val(), 10);
    else if (flag === "--timeout") a.timeout = parseInt(val(), 10);
    else if (flag === "--channel") a.channel = val();
    else if (flag === "--full") a.full = true;
    else if (flag === "--viewport-only") a.full = false;
    else if (flag === "--still") a.still = true;
    else if (flag === "--motion") a.still = false;
    else if (flag === "--verify") a.verify = true;
    else if (flag === "--states") a.states = true;
    else if (flag === "--hover") a.hover = val();
    else if (flag === "--focus") a.focus = val();
    else if (flag === "--click") a.click = val();
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

let target;
if (args.url) {
  target = args.url;
} else if (args.in) {
  const abs = path.resolve(args.in);
  if (!existsSync(abs)) {
    console.error(`[shot] input not found: ${abs}`);
    process.exit(2);
  }
  target = pathToFileURL(abs).href;
} else {
  console.error("[shot] need --in <file.html> or --url <url>");
  process.exit(2);
}
if (!args.out && !args.verify) {
  console.error("[shot] need --out <file.png> (or use --verify)");
  process.exit(2);
}
if (args.out)
  mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });

let browser;
try {
  browser = await launchBrowser({
    headless: true,
    ...(args.channel ? { channel: args.channel } : {}),
  });
} catch (e) {
  console.error("[shot] could not launch a browser.");
  console.error(
    args.channel
      ? `  Channel "${args.channel}" must be installed, or omit --channel and run:  npx playwright install chromium`
      : "  Run:  npx playwright install chromium   (or pass --channel chrome to use installed Chrome)",
  );
  console.error(String((e && e.message) || e));
  process.exit(3);
}

try {
  await run(browser);
} catch (e) {
  console.error(`[shot] ${(e && e.message) || e}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}

async function run(browser) {
  const page = await browser.newPage({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: args.scale,
  });

  if (args.still) await freezeMotion(page, { mode: "stop" });

  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Fonts/images are waited for within --timeout; no networkidle wait.
  await settlePage(page, { timeoutMs: args.timeout, waitMs: args.wait });

  // ── Interaction audit ───────────────────────────────────────────────────────
  if (args.verify) {
    const report = await page.evaluate(() => {
      const interactiveSel =
        'a[href],button,input,select,textarea,[role="button"],[role="link"],' +
        '[role="tab"],[role="menuitem"],[role="switch"],[role="checkbox"],[tabindex]:not([tabindex="-1"]),' +
        '[onclick],summary,label[for],[contenteditable="true"]';
      const clsOf = (el) =>
        typeof el.className === "string"
          ? el.className
          : (el.className && el.className.baseVal) || "";
      const describe = (el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const c = clsOf(el).trim().split(/\s+/).filter(Boolean)[0];
        const cls = c ? `.${c}` : "";
        const txt = (el.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 28);
        return `${tag}${id}${cls}${txt ? ` "${txt}"` : ""}`;
      };

      const interactive = Array.from(document.querySelectorAll(interactiveSel));
      // Real controls (excluding text inputs) that forgot cursor:pointer.
      const noPointer = [];
      for (const el of interactive) {
        const tag = el.tagName.toLowerCase();
        if (["input", "textarea", "select"].includes(tag)) continue;
        if (el.getAttribute("role") === "tab") continue; // tabs sometimes use default cursor
        if (getComputedStyle(el).cursor !== "pointer")
          noPointer.push(describe(el));
      }

      // Clickable-LOOKING elements that are not real controls (the "dead button" bug).
      const suspectRe =
        /(^|[-_ ])(btn|button|link|tab|cta|toggle|chip|pill|nav-?item|menu-?item|clickable|action)([-_ \d]|$)/i;
      const dead = [];
      for (const el of Array.from(
        document.querySelectorAll("div,span,li,p,img,svg"),
      )) {
        if (el.closest(interactiveSel)) continue; // inside a real control → fine
        const looksClickable =
          getComputedStyle(el).cursor === "pointer" ||
          suspectRe.test(clsOf(el)) ||
          suspectRe.test(el.id || "");
        if (!looksClickable) continue;
        if (el.getAttribute("onclick")) continue; // has an inline handler
        dead.push(describe(el));
      }

      // Are there any :hover / :focus rules at all?
      let hoverRules = 0,
        focusRules = 0;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        if (!rules) continue;
        for (const r of Array.from(rules)) {
          const t = (r && r.selectorText) || "";
          if (t.includes(":hover")) hoverRules++;
          if (t.includes(":focus")) focusRules++;
        }
      }
      return {
        interactiveCount: interactive.length,
        noPointer,
        hoverRules,
        focusRules,
        dead: dead.slice(0, 30),
        deadTotal: dead.length,
      };
    });

    const issues = [];
    if (report.interactiveCount === 0)
      issues.push(
        "no real interactive elements (<button>/<a href>/inputs) found",
      );
    if (report.hoverRules === 0)
      issues.push(
        "no :hover rules in any stylesheet — nothing reacts to the mouse",
      );
    if (report.focusRules === 0)
      issues.push("no :focus/:focus-visible rules — no keyboard affordance");
    if (report.deadTotal > 0)
      issues.push(
        `${report.deadTotal} clickable-looking element(s) are not real <button>/<a> controls`,
      );
    if (report.noPointer.length > 0)
      issues.push(
        `${report.noPointer.length} control(s) missing cursor:pointer`,
      );

    console.log("\n[verify] interactivity audit");
    console.log(`  interactive elements : ${report.interactiveCount}`);
    console.log(`  :hover rules         : ${report.hoverRules}`);
    console.log(`  :focus rules         : ${report.focusRules}`);
    if (report.deadTotal) {
      console.log(
        `  clickable-looking but not <button>/<a> (${report.deadTotal}):`,
      );
      for (const d of report.dead) console.log(`    - ${d}`);
      if (report.deadTotal > report.dead.length)
        console.log(`    … and ${report.deadTotal - report.dead.length} more`);
    }
    if (report.noPointer.length) {
      console.log(
        `  controls missing cursor:pointer (${report.noPointer.length}):`,
      );
      for (const d of report.noPointer.slice(0, 15)) console.log(`    - ${d}`);
    }
    console.log(
      issues.length
        ? `\n[verify] WARN — fix before delivery:\n  • ${issues.join("\n  • ")}\n`
        : "\n[verify] PASS — controls are real and have hover/focus affordances.\n",
    );
    return;
  }

  // ── State actions (capture hover/focus/open frames) ──────────────────────────
  async function act(kind, sel) {
    if (!sel) return;
    try {
      await page[kind](sel, { timeout: 5000 });
    } catch (e) {
      console.error(`[shot] --${kind} ${sel} failed: ${e.message}`);
    }
  }
  if (args.click) {
    await act("click", args.click);
    await page.waitForTimeout(250);
  }
  await act("focus", args.focus);
  await act("hover", args.hover);

  const dims = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));

  await page.screenshot({ path: path.resolve(args.out), fullPage: args.full });

  // ── --states: also save hover/focus variants of the primary control ──────────
  if (args.states) {
    const ext = path.extname(args.out) || ".png";
    const stem = args.out.slice(0, args.out.length - ext.length);
    const primary = 'a[href], button, [role="button"]';
    try {
      const el = await page.$(primary);
      if (el) {
        await el.hover();
        await page.screenshot({
          path: path.resolve(`${stem}-hover${ext}`),
          fullPage: false,
        });
      }
    } catch {}
    try {
      const el = await page.$(primary);
      if (el) {
        await el.focus();
        await page.screenshot({
          path: path.resolve(`${stem}-focus${ext}`),
          fullPage: false,
        });
      }
    } catch {}
    console.log(`[shot] states saved ${stem}-hover${ext}, ${stem}-focus${ext}`);
  }

  console.log(
    `[shot] saved ${args.out} — page ${dims.w}x${dims.h}, viewport=${args.width}, scale=${args.scale}, full=${args.full}, still=${args.still}`,
  );
}

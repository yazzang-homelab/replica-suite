/*
 * Shared Playwright browser helpers for the plugin's capture scripts.
 *
 * Playwright is imported from the plugin's own dependencies (resolved relative to this file,
 * not the caller's CWD). Nothing here guesses at runtime: no channel/executable fallback and no
 * unbounded waits. Every wait has an explicit time limit and an unfinished wait is an error.
 */
import { chromium } from "playwright";

/** Launch Chromium with exactly the given playwright `chromium.launch` options. */
export async function launchBrowser(options = {}) {
  return chromium.launch(options);
}

function checkMs(name, value) {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative number, got ${value}`);
}

/**
 * Wait for DOMContentLoaded plus (optionally) web fonts and <img> loads, all within `timeoutMs`.
 * Never waits for network idle. Rejects with an Error naming whatever did not finish.
 * An image that finished with an error (broken) counts as settled; a still-loading one does not.
 * Then waits an extra `waitMs`.
 */
export async function settlePage(
  page,
  { timeoutMs = 15000, waitMs = 0, images = true, fonts = true } = {},
) {
  checkMs("timeoutMs", timeoutMs);
  if (timeoutMs === 0)
    throw new RangeError(
      "timeoutMs must be positive; zero disables Playwright timeouts",
    );
  checkMs("waitMs", waitMs);
  const deadline = Date.now() + timeoutMs;
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs });
  } catch (e) {
    throw new Error(
      `settlePage: DOMContentLoaded not reached within ${timeoutMs}ms: ${e.message}`,
    );
  }
  if (images || fonts) {
    const remaining = Math.max(0, deadline - Date.now());
    let guardTimer;
    const guard = new Promise((_, reject) => {
      guardTimer = setTimeout(
        () =>
          reject(
            new Error(`settlePage: page did not respond within ${timeoutMs}ms`),
          ),
        remaining + 1000,
      );
      guardTimer.unref?.();
    });
    const pending = await Promise.race([
      page.evaluate(
        async ({ remaining, images, fonts }) => {
          const timedOut = Symbol("timeout");
          let timer;
          const limit = new Promise((res) => {
            timer = setTimeout(() => res(timedOut), remaining);
          });
          const unfinished = [];
          const tasks = [];
          // Force layout to discover used font faces. fonts.ready may itself wait
          // for document load (including unrelated images), even when all fonts
          // are loaded. Do not make images:false implicitly wait for images.
          if (fonts) document.documentElement.getBoundingClientRect();
          if (fonts && document.fonts?.status === "loading") {
            tasks.push(
              document.fonts.ready.then(
                () => {},
                () => {},
              ),
            );
          }
          const pendingImages = images
            ? Array.from(document.images).filter((img) => !img.complete)
            : [];
          for (const img of pendingImages) {
            tasks.push(
              new Promise((res) => {
                img.addEventListener("load", res, { once: true });
                img.addEventListener("error", res, { once: true });
                if (img.complete) res();
              }),
            );
          }
          const done = await Promise.race([
            Promise.all(tasks).then(() => true),
            limit,
          ]);
          clearTimeout(timer);
          if (done === timedOut) {
            if (fonts && document.fonts && document.fonts.status === "loading")
              unfinished.push("fonts");
            for (const img of pendingImages)
              if (!img.complete)
                unfinished.push(`image:${img.currentSrc || img.src}`);
            if (!unfinished.length) unfinished.push("unknown");
          }
          return unfinished;
        },
        { remaining, images, fonts },
      ),
      guard,
    ]).finally(() => clearTimeout(guardTimer));
    if (pending.length) {
      throw new Error(
        `settlePage: not settled within ${timeoutMs}ms: ${pending.join(", ")}`,
      );
    }
  }
  if (waitMs > 0) await page.waitForTimeout(waitMs);
}

/*
 * mode 'stop'   : animations and transitions are removed (final/base style, no motion at all).
 * mode 'finish' : animations still run but are shortened to 0.001s, one iteration, so they land
 *                 on their end state; transitions become instant.
 * Both hide the text caret and disable smooth scrolling.
 */
const MOTION_CSS = {
  stop:
    "*,*::before,*::after{animation:none!important;-webkit-animation:none!important;" +
    "transition:none!important;animation-duration:0s!important;transition-duration:0s!important;" +
    "scroll-behavior:auto!important;caret-color:transparent!important}",
  finish:
    "*,*::before,*::after{animation-delay:0s!important;animation-duration:0.001s!important;" +
    "animation-iteration-count:1!important;transition-delay:0s!important;transition-duration:0s!important;" +
    "scroll-behavior:auto!important;caret-color:transparent!important}",
};

/**
 * Stabilize motion on the current document and on documents loaded later in this page.
 * Call before navigation for init-time freezing, after navigation for loaded-state freezing.
 * Scroll position and media playback remain the caller's responsibility. Idempotent per mode.
 */
export async function freezeMotion(page, { mode = "stop" } = {}) {
  if (!Object.hasOwn(MOTION_CSS, mode)) {
    throw new Error(
      `freezeMotion: unknown mode "${mode}" (use "stop" or "finish")`,
    );
  }
  const apply = (css) => {
    const id = "__plugin_freeze_motion__";
    const run = () => {
      let s = document.getElementById(id);
      if (!s) {
        s = document.createElement("style");
        s.id = id;
        (document.head || document.documentElement).appendChild(s);
      }
      s.textContent = css;
    };
    if (document.head || document.documentElement) run();
    else addEventListener("DOMContentLoaded", run, { once: true });
  };
  const css = MOTION_CSS[mode];
  await page.addInitScript(apply, css);
  await page.evaluate(apply, css);
}

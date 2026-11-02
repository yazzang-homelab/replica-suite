/* UI·UX 계약을 실제 Chromium에서 실행하고 재현 가능한 증거를 남긴다. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import axe from "axe-core";
import { launchBrowser, settlePage } from "./browser.mjs";
import { startOriginProxy } from "./uiux-proxy.mjs";
import { assessExpectedEvents } from "./uiux-expectations.mjs";

const require = createRequire(import.meta.url);
const AXE_SOURCE = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const ACTIONS = new Set([
  "goto", "fill", "click", "press", "assert-text", "assert-visible", "assert-hidden", "reload",
]);
const ASSERTIONS = new Set(["assert-text", "assert-visible", "assert-hidden"]);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const digest = (value) => createHash("sha256").update(value).digest("hex");
const errorText = (error) => String(error?.message ?? error).slice(0, 4000);

function httpURL(value, label) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new TypeError(`${label}: 인증정보 없는 http/https URL이 필요합니다.`);
  return url;
}

export function validateInput(contract, baseUrl, timeoutMs, allowOrigins) {
  if (!contract || contract.schema_version !== 1 || !["web", "electron"].includes(contract.project?.platform))
    throw new TypeError("웹 실행에는 schema_version=1 및 web/electron 플랫폼 계약이 필요합니다.");
  if (!Array.isArray(contract.viewports) || !contract.viewports.length || contract.viewports.length > 12)
    throw new TypeError("1~12개 viewport가 필요합니다.");
  for (const viewport of contract.viewports) {
    if (!viewport || typeof viewport.name !== "string" || !viewport.name ||
        !Number.isInteger(viewport.width) || viewport.width < 240 || viewport.width > 7680 ||
        !Number.isInteger(viewport.height) || viewport.height < 240 || viewport.height > 7680 ||
        !Number.isFinite(viewport.device_scale_factor ?? 1) ||
        (viewport.device_scale_factor ?? 1) < 0.5 || (viewport.device_scale_factor ?? 1) > 3)
      throw new TypeError("viewport 이름·크기·device_scale_factor가 올바르지 않습니다.");
  }
  if (!Array.isArray(contract.flows) || !contract.flows.length || contract.flows.length > 100)
    throw new TypeError("1~100개 flow가 필요합니다.");
  const base = httpURL(baseUrl, "baseUrl");
  for (const flow of contract.flows) {
    if (!flow || typeof flow.id !== "string" || !flow.id || !Array.isArray(flow.steps) ||
        !flow.steps.length || flow.steps.length > 100 || flow.steps[0]?.action !== "goto" ||
        !flow.steps.some((step) => ASSERTIONS.has(step.action)))
      throw new TypeError("각 flow에는 id, 첫 goto 및 명시적인 assert 단계가 필요합니다.");
    for (const step of flow.steps) {
      if (!step || !ACTIONS.has(step.action)) throw new TypeError("지원하지 않는 flow action입니다.");
      if (step.action === "goto") {
        if (typeof step.path !== "string" || !step.path || /^[a-z][a-z\d+.-]*:/i.test(step.path) ||
            step.path.startsWith("//") || step.path.includes("\\") || new URL(step.path, base).origin !== base.origin)
          throw new TypeError("goto.path는 baseUrl과 동일 origin의 상대 경로여야 합니다.");
      } else if (step.action !== "reload") {
        const target = step.target;
        if (!target || typeof target !== "object" || Array.isArray(target))
          throw new TypeError("이 action에는 target이 필요합니다.");
        const variants = Number(typeof target.role === "string" && target.role.length > 0 &&
          typeof target.name === "string" && target.name.length > 0) +
          Number(typeof target.test_id === "string" && target.test_id.length > 0) +
          Number(typeof target.selector === "string" && target.selector.length > 0);
        if (variants !== 1) throw new TypeError("target은 role/name, test_id, selector 중 하나여야 합니다.");
        if (step.action === "fill" && typeof step.value !== "string")
          throw new TypeError("fill.value는 문자열이어야 합니다.");
        if (step.action === "press" && (typeof step.key !== "string" || !step.key))
          throw new TypeError("press.key는 비어 있지 않은 문자열이어야 합니다.");
        if (step.action === "assert-text" && typeof step.text !== "string")
          throw new TypeError("assert-text.text는 문자열이어야 합니다.");
      }
    }
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000)
    throw new TypeError("timeoutMs는 100~120000 사이 정수여야 합니다.");
  if (!Array.isArray(allowOrigins)) throw new TypeError("allowOrigins는 origin 배열이어야 합니다.");
  const origins = new Set([base.origin]);
  for (const value of allowOrigins) {
    const url = httpURL(value, "allowOrigins");
    if (url.href !== `${url.origin}/`) throw new TypeError("allowOrigins에는 경로 없는 origin만 지정합니다.");
    origins.add(url.origin);
  }
  return { base, origins };
}

function locatorFor(page, target) {
  if (target.role) return page.getByRole(target.role, { name: target.name, exact: true });
  if (target.test_id) return page.getByTestId(target.test_id);
  return page.locator(target.selector);
}

async function bounded(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: ${timeoutMs}ms 제한을 넘었습니다.`)), timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

async function assertText(locator, expected, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let actual = "";
  await locator.waitFor({ state: "visible", timeout: timeoutMs });
  do {
    actual = await locator.innerText({ timeout: Math.max(1, deadline - Date.now()) });
    if (actual.trim() === expected.trim()) return;
    await new Promise((resolve) => setTimeout(resolve, Math.min(50, Math.max(1, deadline - Date.now()))));
  } while (Date.now() < deadline);
  throw new Error(`텍스트 불일치: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
}

async function performStep(page, step, base, timeoutMs) {
  if (step.action === "goto") {
    await page.goto(new URL(step.path, base).href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } else if (step.action === "reload") {
    await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  } else {
    const locator = locatorFor(page, step.target);
    switch (step.action) {
      case "fill": await locator.fill(step.value, { timeout: timeoutMs }); break;
      case "click": await locator.click({ timeout: timeoutMs }); break;
      case "press": await locator.press(step.key, { timeout: timeoutMs }); break;
      case "assert-text": await assertText(locator, step.text, timeoutMs); break;
      case "assert-visible": await locator.waitFor({ state: "visible", timeout: timeoutMs }); break;
      case "assert-hidden": await locator.waitFor({ state: "hidden", timeout: timeoutMs }); break;
    }
  }
  if (page.url() !== "about:blank" && new URL(page.url()).origin !== base.origin)
    throw new Error("flow가 baseUrl 외부로 이동했습니다.");
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const overflow = Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0) - width;
    const smallTargets = [];
    for (const element of document.querySelectorAll("button,a[href],input:not([type=hidden]),select,textarea,[role=button]")) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none" || !rect.width || !rect.height) continue;
      if (rect.width < 24 || rect.height < 24) {
        smallTargets.push({
          tag: element.tagName.toLowerCase(),
          name: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 100),
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        });
      }
    }
    return { viewport_width: width, scroll_width: root.scrollWidth, horizontal_overflow: Math.max(0, overflow),
      small_targets: smallTargets.slice(0, 100), small_target_count: smallTargets.length };
  });
}

async function scanFrames(page, timeoutMs) {
  const frames = page.frames();
  const results = [], errors = [];
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());
  for (const [index, frame] of frames.entries()) {
    if (index >= 50 || Date.now() >= deadline) {
      errors.push({ frame_index: index, message: "frame 수 또는 전체 접근성 검사 시간 제한으로 검사하지 못했습니다." });
      continue;
    }
    let url;
    try { const parsed = new URL(frame.url()); url = `${parsed.origin}${parsed.pathname}`; }
    catch { url = "URL을 확인하지 못한 frame"; }
    try {
      await bounded(frame.evaluate(AXE_SOURCE), remaining(), "frame axe 엔진 주입");
      const result = await bounded(frame.evaluate(async (tags) => {
        // 모든 frame을 직접 검사하므로 axe의 조용한 하위 frame 생략에 의존하지 않는다.
        const scan = await globalThis.axe.run(document, { iframes: false,
          runOnly: { type: "tag", values: tags }, resultTypes: ["violations", "incomplete"] });
        return { violations: scan.violations, incomplete: scan.incomplete,
          testEngine: scan.testEngine, testEnvironment: scan.testEnvironment };
      }, TAGS), remaining(), "frame axe 검사");
      results.push({ frame_index: index, url, ...result });
    } catch (error) { errors.push({ frame_index: index, url, message: errorText(error) }); }
  }
  if (page.frames().some((frame) => !frames.includes(frame)))
    errors.push({ message: "검사 중 새로운 frame이 생성되어 모두 확인하지 못했습니다." });
  function merge(field) {
    const rules = new Map();
    for (const frame of results) for (const rule of frame[field]) {
      const nodes = rule.nodes.map((node) => ({ ...node, frame_index: frame.frame_index, frame_url: frame.url }));
      if (rules.has(rule.id)) rules.get(rule.id).nodes.push(...nodes);
      else rules.set(rule.id, { ...rule, nodes });
    }
    return [...rules.values()];
  }
  return { violations: merge("violations"), incomplete: merge("incomplete"), frame_errors: errors,
    frames: results, testEngine: results[0]?.testEngine, testEnvironment: results[0]?.testEnvironment };
}

/**
 * 전달받은 계약만 실행한다. 셸·임의 JavaScript·실사용 브라우저 프로필은 받지 않는다.
 * redirect 목적지를 포함한 매 요청을 소유 proxy에서 검사하고 본문은 스트리밍한다.
 * 이 origin 필터는 브라우저 자원 요청 제어이며 OS 보안 샌드박스가 아니다.
 */
export async function runWebAudit({ contract, baseUrl, outDir, executablePath, timeoutMs = 15000, allowOrigins = [] }) {
  const { base, origins } = validateInput(contract, baseUrl, timeoutMs, allowOrigins);
  if (typeof outDir !== "string" || !outDir) throw new TypeError("outDir가 필요합니다.");
  const result = {
    schema_version: 1, kind: "web", status: "incomplete",
    environment: { platform: process.platform, architecture: process.arch, node: process.version,
      engine: "Chromium", browser: null, executable: executablePath ? basename(executablePath) : "bundled-chromium",
      axe: axe.version, headless: true, browser_sandbox: "Playwright 기본값(Chromium sandbox 비활성)",
      allowed_origins: [...origins] },
    checks: [], artifacts: [], limitations: [
      "자동 접근성 검사는 전체 WCAG 준수·사용성·미적 품질을 증명하지 않습니다.",
      "각 viewport×flow는 독립된 임시 브라우저 context입니다. 기존 로그인과 파일·쿠키를 가져오지 않습니다.",
      "HTTP(S) 요청·redirect는 소유 loopback 프록시에서 origin을 검사합니다. 허용 origin 안의 redirect와 SSE는 전달합니다.",
      "origin 필터는 HTTP(S)/WebSocket 요청용입니다. 임의 악성 코드의 OS·네트워크 격리를 보장하지 않습니다.",
      "검수는 goto/reload/assert 직후 상태를 측정합니다. 중간의 짧은 상태와 수동 보조기술 조작은 별도 검토가 필요합니다.",
      "24 CSS px 미만 조작 대상은 간격·문맥 예외를 평가하지 않은 권고이며 WCAG 위반 판정이 아닙니다.",
    ],
  };
  if (contract.project.platform === "electron")
    result.limitations.push("Electron의 HTTP로 제공되는 renderer만 검사합니다. 네이티브 메뉴·IPC·설치 프로그램은 실행하지 않습니다.");
  await mkdir(join(outDir, "web"), { recursive: true });

  function add(id, status, message, extra = {}) {
    result.checks.push({ id, status, message, ...extra });
  }
  async function artifact(path, data) {
    const bytes = typeof data === "string" ? Buffer.from(data) : data;
    await writeFile(join(outDir, path), bytes, { flag: "wx" });
    result.artifacts.push({ path, sha256: digest(bytes), bytes: bytes.length });
    return path;
  }
  let browser;
  try {
    browser = await launchBrowser({ headless: true, timeout: timeoutMs,
      ...(executablePath ? { executablePath } : {}) });
    result.environment.browser = browser.version();
    add("web.browser.launch", "pass", "Chromium을 실행했습니다.", { kind: "runtime" });
    for (const [vi, viewport] of contract.viewports.entries()) {
      for (const [fi, flow] of contract.flows.entries()) {
        const prefix = `web.v${vi}.f${fi}`;
        const identity = { viewport: viewport.name, flow: flow.id };
        const stateBase = `web/v${vi}-f${fi}`;
        const blocked = [], runtimeErrors = [], failedResponses = [], observedDialogs = [], pendingDialogs = [];
        let context, page, proxy;
        let closing = false;
        let finished = false;
        let stoppedAt = -1;
        try {
          proxy = await startOriginProxy({ origins, timeoutMs,
            onBlock: (event) => { if (!closing) blocked.push(event); },
            onError: (message) => { if (!closing) runtimeErrors.push({ type: "proxy", message }); } });
          context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
            deviceScaleFactor: viewport.device_scale_factor ?? 1, acceptDownloads: false,
            serviceWorkers: "block", locale: contract.project.locale ?? "ko-KR", reducedMotion: "reduce", proxy: proxy.settings });
          context.setDefaultTimeout(timeoutMs);
          context.setDefaultNavigationTimeout(timeoutMs);
          // 1차 요청 검사는 Playwright, redirect/worker를 포함한 실제 전송은 proxy가 검사한다.
          await context.route("**/*", async (route) => {
            try {
              const request = route.request();
              const url = new URL(request.url());
              if (!["http:", "https:"].includes(url.protocol) || !origins.has(url.origin) || url.username || url.password) {
                blocked.push({ kind: "origin", url: `${url.origin}${url.pathname}` });
                await route.abort("blockedbyclient");
                return;
              }
              await route.continue();
            } catch (error) {
              if (closing) return;
              runtimeErrors.push({ type: "request", message: errorText(error) });
              await route.abort("failed").catch(() => {});
            }
          });
          context.on("response", (response) => {
            if (closing || response.status() < 400) return;
            const url = new URL(response.url());
            failedResponses.push({ status: response.status(), method: response.request().method(), url: `${url.origin}${url.pathname}` });
          });
          await context.routeWebSocket("**/*", (socket) => {
            const url = new URL(socket.url());
            const origin = `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
            if (!origins.has(origin) || url.username || url.password) {
              blocked.push({ kind: "websocket", url: `${url.origin}${url.pathname}` });
              void socket.close({ code: 1008, reason: "허용되지 않은 origin" }).catch(() => {});
            } else { proxy.authorizeWebSocket(socket.url()); socket.connectToServer(); }
          });
          context.on("page", (popup) => {
            if (page && popup !== page) {
              blocked.push({ kind: "popup", url: "새 창은 계약 실행 대상이 아닙니다." });
              void popup.close().catch(() => {});
            }
          });
          page = await context.newPage();
          page.on("console", (message) => {
            if (!closing && message.type() === "error") {
              const full = message.text();
              runtimeErrors.push({type:"console.error",message:full.slice(0,4000),truncated:full.length>4000,full_length:full.length,url:message.location().url});
            }
          });
          page.on("pageerror", (error) => { if (!closing) runtimeErrors.push({ type: "pageerror", message: errorText(error) }); });
          page.on("dialog", (dialog) => {
            const expected = flow.dialogs?.[observedDialogs.length];
            const matches = expected && expected.type === dialog.type() && expected.message === dialog.message();
            const observed = {type:dialog.type(), message:dialog.message(), action:matches?expected.action:"dismiss", settled:false};
            observedDialogs.push(observed);
            const operation = observed.action === "accept" ? dialog.accept(expected?.prompt_text) : dialog.dismiss();
            pendingDialogs.push(operation.then(() => {observed.settled=true;}).catch(error => {observed.error=errorText(error);}));
          });
          page.on("download", (download) => {
            blocked.push({ kind: "download", url: "파일 다운로드를 차단했습니다." });
            void download.cancel().catch(() => {});
          });

          async function inspectState(si) {
            const stateId = `${prefix}.s${si}`;
            const extra = { ...identity, step: si };
            try {
              await settlePage(page, { timeoutMs });
              add(`${stateId}.settle`, "pass", "문서·글꼴·이미지 로드가 정리됐습니다.", { kind: "runtime", ...extra });
            } catch (error) {
              add(`${stateId}.settle`, "incomplete", errorText(error), { kind: "runtime", ...extra });
            }
            try {
              const screenshot = await page.screenshot({ type: "png", fullPage: false, animations: "disabled", timeout: timeoutMs });
              const path = await artifact(`${stateBase}-s${si}.png`, screenshot);
              add(`${stateId}.capture`, "pass", "viewport 스크린샷을 저장했습니다.", { kind: "capture", evidence: path, ...extra });
            } catch (error) {
              add(`${stateId}.capture`, "incomplete", errorText(error), { kind: "capture", ...extra });
            }
            try {
              const scan = await scanFrames(page, timeoutMs);
              const path = await artifact(`${stateBase}-s${si}.axe.json`, JSON.stringify(scan, null, 2) + "\n");
              const status = scan.violations.length ? "fail" : scan.incomplete.length || scan.frame_errors.length ? "incomplete" : "pass";
              add(`${stateId}.a11y`, status,
                `WCAG 자동 검사: 위반 ${scan.violations.length}개 규칙, 수동 확인 ${scan.incomplete.length}개 규칙, 미검사 frame ${scan.frame_errors.length}개.`,
                { kind: "a11y", evidence: path, violations: scan.violations.map((rule) => rule.id),
                  incomplete: scan.incomplete.map((rule) => rule.id), frame_errors: scan.frame_errors,
                  inspected_frames: scan.frames.length, ...extra });
            } catch (error) {
              add(`${stateId}.a11y`, "incomplete", errorText(error), { kind: "a11y", ...extra });
            }
            try {
              const layout = await bounded(measureLayout(page), timeoutMs, "레이아웃 검사");
              add(`${stateId}.overflow`, layout.horizontal_overflow > 1 ? "fail" : "pass",
                `가로 넘침: ${layout.horizontal_overflow}px.`, { kind: "layout", ...extra,
                  evidence: { viewport_width: layout.viewport_width, scroll_width: layout.scroll_width } });
              add(`${stateId}.targets`, "pass", `24 CSS px 미만 조작 대상 ${layout.small_target_count}개(문맥 확인 권고).`,
                { kind: "advisory", severity: "advisory", evidence: layout.small_targets, ...extra });
            } catch (error) {
              add(`${stateId}.layout`, "incomplete", errorText(error), { kind: "layout", ...extra });
            }
          }

          for (const [si, step] of flow.steps.entries()) {
            stoppedAt = si;
            try {
              await performStep(page, step, base, timeoutMs);
              add(`${prefix}.step${si}`, "pass", `${step.action} 실행 완료.`, { kind: "step", step: si, ...identity });
            } catch (error) {
              add(`${prefix}.step${si}`, "fail", errorText(error), { kind: "step", step: si, ...identity });
              await inspectState(si);
              throw error;
            }
            if (step.action === "goto" || step.action === "reload" || ASSERTIONS.has(step.action))
              await inspectState(si);
          }
          finished = true;
          add(`${prefix}.flow`, "pass", "계약에 명시한 모든 동작과 assertion을 실행했습니다.", { kind: "flow", ...identity });
        } catch (error) {
          add(`${prefix}.flow`, page ? "fail" : "incomplete", errorText(error), { kind: "flow", ...identity });
          for (let si = stoppedAt + 1; si < flow.steps.length; si++)
            add(`${prefix}.step${si}`, "incomplete", "앞선 단계 또는 실행 환경 실패로 실행하지 못했습니다.",
              { kind: "step", step: si, ...identity });
        } finally {
          if (pendingDialogs.length) {
            try { await bounded(Promise.allSettled(pendingDialogs), timeoutMs, "native dialog 처리 정리"); }
            catch (error) { runtimeErrors.push({type:"dialog",message:errorText(error)}); }
          }
          closing = true;
          if (context) {
            try { await bounded(context.close(), timeoutMs, "브라우저 context 정리"); }
            catch (error) { add(`${prefix}.cleanup`, "incomplete", errorText(error), { kind: "runtime", ...identity }); }
          }
          if (proxy) {
            try {
              await bounded(proxy.close(), timeoutMs, "감사 프록시 정리");
              add(`${prefix}.proxy`, proxy.stats.http_requests + proxy.stats.connect_tunnels > 0 ? "pass" : "incomplete",
                "소유 프록시와 연결을 종료했습니다. 요청 기록으로 localhost 우회 비활성 여부를 확인합니다.",
                { kind: "runtime", evidence: { ...proxy.stats }, ...identity });
            } catch (error) { add(`${prefix}.proxy`, "incomplete", errorText(error), { kind: "runtime", ...identity }); }
          }
          add(`${prefix}.network`, blocked.length ? "fail" : "pass",
            `정책에 의해 차단한 요청·창·다운로드 ${blocked.length}건.`, { kind: "network", evidence: blocked, ...identity });
          const events=assessExpectedEvents({flow,baseUrl:base.href,httpErrors:failedResponses,runtimeErrors,dialogs:observedDialogs});
          for (const check of events.checks) add(`${prefix}.${check.id}`,check.status,check.message,{kind:"expected",evidence:check.evidence,...identity});
          add(`${prefix}.runtime`, events.unexpectedRuntime.length || events.unexpectedHttp.length ? "fail" : finished ? "pass" : "incomplete",
            `예상하지 않은 런타임 오류 ${events.unexpectedRuntime.length}건, HTTP 오류 ${events.unexpectedHttp.length}건.`,
            { kind: "runtime", evidence: { errors: events.unexpectedRuntime, http_errors: events.unexpectedHttp, observed_errors:runtimeErrors, observed_http_errors:failedResponses }, ...identity });
        }
      }
    }
  } catch (error) {
    add("web.browser.execution", "incomplete", errorText(error), { kind: "runtime" });
  } finally {
    if (browser) {
      try {
        await bounded(browser.close(), timeoutMs, "브라우저 종료");
        add("web.browser.cleanup", "pass", "이 검사에서 실행한 Chromium을 종료했습니다.", { kind: "runtime" });
      } catch (error) { add("web.browser.cleanup", "incomplete", errorText(error), { kind: "runtime" }); }
    }
  }
  result.status = result.checks.some((check) => check.status === "fail") ? "fail" :
    result.checks.some((check) => check.status === "incomplete") || !result.checks.length ? "incomplete" : "pass";
  return result;
}

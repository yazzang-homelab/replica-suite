/* 실제 CLI→Chromium→증거 검증→HTML 보고서의 독립 통합 검사. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import axe from "axe-core";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "scripts/uiux.mjs");
const temporary = await mkdtemp(join(tmpdir(), "replica-uiux-cli-e2e-"));
const cwd = join(temporary, "다른 작업 폴더");
await mkdir(cwd);
const executablePath = process.env.REPLICA_TEST_BROWSER_EXECUTABLE;
const launched = new Set();
const observedProcesses = new Map();
const groups = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let reportBrowser;
let reportPreview;

async function processState(pid) {
  if (process.platform !== "linux") return null;
  try {
    const line = await readFile(`/proc/${pid}/stat`, "utf8");
    const fields = line.slice(line.lastIndexOf(")") + 2).split(" ");
    return { state: fields[0], started: fields[19] };
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") return null;
    throw error;
  }
}
async function observeChildren(pid) {
  const state = await processState(pid);
  if (!state) return;
  observedProcesses.set(pid, state.started);
  try {
    const children = await readFile(`/proc/${pid}/task/${pid}/children`, "utf8");
    await Promise.all(children.trim().split(/\s+/).filter(Boolean).map((value) => observeChildren(Number(value))));
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ESRCH") throw error;
  }
}
async function runningOwnedProcesses() {
  const running = [];
  for (const [pid, started] of observedProcesses) {
    const state = await processState(pid);
    if (state?.started === started && !["Z", "X"].includes(state.state)) running.push(pid);
  }
  return running;
}
async function run(args, expected = 0) {
  const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  launched.add(child);
  let stdout = "", stderr = "", polling = false;
  const polls = new Set();
  child.stdout.on("data", (data) => { stdout += data.toString(); });
  child.stderr.on("data", (data) => { stderr += data.toString(); });
  const observe = () => {
    if (polling || !child.pid || process.platform !== "linux") return;
    polling = true;
    const pending = observeChildren(child.pid).finally(() => { polling = false; polls.delete(pending); });
    polls.add(pending);
  };
  observe();
  const watcher = setInterval(observe, 75);
  const timer = setTimeout(() => child.kill("SIGKILL"), 90000);
  try {
    const outcome = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    let auditFailures;
    if (outcome.code !== expected && args[0] === "audit" && args.includes("--out")) {
      try {
        const result = JSON.parse(await readFile(join(args[args.indexOf("--out") + 1], "result.json"), "utf8"));
        auditFailures = result.checks.filter((check) => check.status !== "pass");
      } catch { /* 입력 오류에는 결과 파일이 없다. */ }
    }
    assert.equal(outcome.code, expected, `${args[0]} 종료값: ${JSON.stringify({ ...outcome, stdout, stderr, auditFailures })}`);
    return { code: outcome.code, stdout, stderr, json: stdout.trim() ? JSON.parse(stdout) : null };
  } finally {
    clearTimeout(timer);
    clearInterval(watcher);
    await Promise.all(polls);
    launched.delete(child);
  }
}
async function json(path) { return JSON.parse(await readFile(path, "utf8")); }
async function absent(path) {
  await assert.rejects(stat(path), (error) => error.code === "ENOENT");
}
const contractFile = join(temporary, "실행 계약.json");
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>메모 편집기 검수</title><style>body{margin:24px;background:white;color:#111;font:18px/1.5 Arial,sans-serif}main{max-width:600px}input,button{box-sizing:border-box;max-width:100%;font:inherit;padding:10px;border:2px solid #222}label{display:block}button{background:#12365b;color:white}input:focus-visible,button:focus-visible{outline:3px solid #111;outline-offset:3px}</style></head><body><main><h1>메모 편집기</h1><label for="memo">메모</label><input id="memo"><button id="save">저장</button><p role="status" id="status">미저장</p></main><script>const memo=document.getElementById('memo'),status=document.getElementById('status');memo.value=localStorage.getItem('memo')||'';if(memo.value)status.textContent='저장됨: '+memo.value;document.getElementById('save').onclick=()=>{localStorage.setItem('memo',memo.value);status.textContent='저장됨: '+memo.value;};</script></body></html>`;
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browserArguments = executablePath ? ["--browser-executable", executablePath] : [];
function auditArguments(contract, output, extra = []) {
  const browser = extra.includes("--browser-executable") ? [] : browserArguments;
  return ["audit", "--contract", contract, "--base-url", baseUrl, "--out", output,
    "--timeout-ms", "10000", ...browser, ...extra];
}
try {
  const initialized = await run(["init", "--name", "메모 편집기", "--platform", "web", "--out", contractFile]);
  assert.equal(initialized.json.status, "created");
  const contract = await json(contractFile);
  assert.equal(contract.project.platform, "web");
  contract.project.audience = "키보드와 터치로 메모를 편집하는 테스트 사용자";
  contract.goals = ["메모를 저장하고 재로드 후 같은 내용을 확인한다"];
  contract.viewports = [{ name: "desktop", width: 1100, height: 760 }, { name: "mobile", width: 390, height: 700 }];
  contract.flows = [{ id: "save", title: "메모 저장·재로드", steps: [
    { action: "goto", path: "/" },
    { action: "fill", target: { role: "textbox", name: "메모" }, value: "합성 메모" },
    { action: "click", target: { role: "button", name: "저장" } },
    { action: "assert-text", target: { role: "status", name: "" }, text: "저장됨: 합성 메모" },
    { action: "reload" },
    { action: "assert-text", target: { selector: "#status" }, text: "저장됨: 합성 메모" },
  ] }];
  // 이름 없는 status는 selector를 써서 role/name 계약의 빈 이름 거부와 구분한다.
  contract.flows[0].steps[3].target = { selector: "#status" };
  contract.states = [{ id: "saved", title: "저장 후 재로드", flow_id: "save" }];
  await writeFile(contractFile, JSON.stringify(contract));
  const validated = await run(["validate", "--contract", contractFile]);
  assert.equal(validated.json.scope, "contract-structure");
  assert.equal(validated.json.viewports, 2);
  groups.push("다른 CWD와 한글·공백 경로에서 init→validate 실행");

  const goodDirectory = join(temporary, "good");
  const good = await run(auditArguments(contractFile, goodDirectory));
  assert.equal(good.json.status, "pass");
  const goodResult = await json(join(goodDirectory, "result.json"));
  assert.equal(goodResult.checks.filter((check) => check.kind === "flow" && check.status === "pass").length, 2);
  const goodVerification = await run(["verify", "--bundle", goodDirectory]);
  assert.equal(goodVerification.json.integrity, "pass");
  assert.equal(goodVerification.json.audit_status, "pass");
  groups.push("CLI audit 종료0: 실제 두 viewport 저장·재로드 및 verify 무결성 통과");

  const injected = "<img src=x onerror=globalThis.__uiuxInjected=1>";
  const failureContract = structuredClone(contract);
  failureContract.viewports = [contract.viewports[0]];
  failureContract.flows[0].steps = [{ action: "goto", path: "/" },
    { action: "assert-visible", target: { selector: `[data-attack="${injected}"]` } }];
  const failureContractFile = join(temporary, "failure-contract.json");
  await writeFile(failureContractFile, JSON.stringify(failureContract));
  const failureDirectory = join(temporary, "failure");
  const failure = await run(auditArguments(failureContractFile, failureDirectory), 1);
  assert.equal(failure.json.status, "fail");
  const failureBefore = hash(await readFile(join(failureDirectory, "result.json")));
  assert.ok((await json(join(failureDirectory, "result.json"))).checks.some((check) => check.message.includes(injected)));
  const failureVerification = await run(["verify", "--bundle", failureDirectory]);
  assert.equal(failureVerification.json.audit_status, "fail");
  await run(auditArguments(contractFile, failureDirectory), 2);
  assert.equal(hash(await readFile(join(failureDirectory, "result.json"))), failureBefore);
  groups.push("CLI audit 종료1과 무결성 종료0의 의미 구분, 기존 실패 증거 덮어쓰기 거부");

  const missingBrowserDirectory = join(temporary, "missing-browser");
  const missingBrowser = await run(auditArguments(contractFile, missingBrowserDirectory,
    ["--browser-executable", join(temporary, "없는 Chromium")]), 3);
  assert.equal(missingBrowser.json.status, "incomplete");
  const missingBrowserVerification = await run(["verify", "--bundle", missingBrowserDirectory]);
  assert.equal(missingBrowserVerification.json.audit_status, "incomplete");
  groups.push("브라우저 실행 누락은 CLI 종료3이며 무결성 통과와 실행 통과를 구분");

  const malformedContractFile = join(temporary, "malformed.json");
  await writeFile(malformedContractFile, "{");
  const malformedDirectory = join(temporary, "malformed-output");
  const malformed = await run(auditArguments(malformedContractFile, malformedDirectory), 2);
  assert.equal(JSON.parse(malformed.stderr).status, "error");
  await absent(malformedDirectory);
  const noAssertionContract = structuredClone(contract);
  noAssertionContract.flows[0].steps = [{ action: "goto", path: "/" }, { action: "reload" }];
  const noAssertionFile = join(temporary, "no-assert.json");
  await writeFile(noAssertionFile, JSON.stringify(noAssertionContract));
  const noAssertionDirectory = join(temporary, "no-assert-output");
  await run(auditArguments(noAssertionFile, noAssertionDirectory), 2);
  await absent(noAssertionDirectory);
  for (const [name, origin] of [["malformed-origin", "not-a-url"], ["origin-path", "https://cdn.example.invalid/assets"]]) {
    const destination = join(temporary, name);
    await run(auditArguments(contractFile, destination, ["--allow-origin", origin]), 2);
    await absent(destination);
  }
  const unchangedContract = hash(await readFile(contractFile));
  await run(["init", "--out", contractFile], 2);
  assert.equal(hash(await readFile(contractFile)), unchangedContract);
  await run(["validate", "--contract", contractFile, "--typo", "x"], 2);
  groups.push("잘못된 JSON·assert 없는 계약·origin·옵션 종료2, 출력 생성·원본 덮어쓰기 없음");

  const snapshot = { schema_version: 1, widgets: [{ id: "label:0", kind: "QLabel", rect: [0, 0, 160, 32],
    parent_rect: [0, 0, 320, 200], text: "상태", text_width: 24, text_height: 16,
    available_width: 160, available_height: 32, interactive: false, accessible_name: "", scroll_content: false, visible: true }] };
  const snapshotFile = join(temporary, "widgets.json");
  await writeFile(snapshotFile, JSON.stringify(snapshot));
  const qtDirectory = join(temporary, "qt-snapshot");
  const qt = await run(["qt", "--snapshot", snapshotFile, "--out", qtDirectory,
    "--python", process.env.REPLICA_TEST_PYTHON || "python3"], 3);
  assert.equal(qt.json.status, "incomplete");
  const qtResult = await json(join(qtDirectory, "result.json"));
  assert.equal(qtResult.environment.backend, "snapshot");
  assert.ok(qtResult.checks.some((check) => check.id === "qt.runtime" && check.status === "incomplete"));
  const qtVerification = await run(["verify", "--bundle", qtDirectory]);
  assert.equal(qtVerification.json.audit_status, "incomplete");
  const malformedSnapshotFile = join(temporary, "malformed-widgets.json");
  await writeFile(malformedSnapshotFile, JSON.stringify({ schema_version: 1, widgets: [{ id: "missing-fields" }] }));
  const malformedQtDirectory = join(temporary, "malformed-qt-output");
  await run(["qt", "--snapshot", malformedSnapshotFile, "--out", malformedQtDirectory,
    "--python", process.env.REPLICA_TEST_PYTHON || "python3"], 2);
  await absent(malformedQtDirectory);
  const failedSnapshot = structuredClone(snapshot);
  failedSnapshot.widgets[0].text_width = 999;
  const failedSnapshotFile = join(temporary, "failed-widgets.json");
  await writeFile(failedSnapshotFile, JSON.stringify(failedSnapshot));
  const failedQtDirectory = join(temporary, "failed-qt");
  const failedQt = await run(["qt", "--snapshot", failedSnapshotFile, "--out", failedQtDirectory,
    "--python", process.env.REPLICA_TEST_PYTHON || "python3"], 1);
  assert.equal(failedQt.json.status, "fail");
  groups.push("Qt snapshot 정상도 미검증 종료3, 결함 종료1, 구조오류 종료2와 출력 생성 없음");

  for (const mode of ["changed", "missing", "extra"]) {
    const destination = join(temporary, `integrity-${mode}`);
    await cp(goodDirectory, destination, { recursive: true });
    const png = goodResult.artifacts.find((artifact) => artifact.path.endsWith(".png")).path;
    if (mode === "changed") await writeFile(join(destination, png), "tampered PNG");
    if (mode === "missing") await rm(join(destination, png));
    if (mode === "extra") await writeFile(join(destination, "unlisted.txt"), "추가 파일");
    const verification = await run(["verify", "--bundle", destination], 1);
    assert.equal(verification.json.integrity, "fail");
  }
  groups.push("실제 감사 묶음의 PNG 변조·누락·미등록 파일을 CLI verify 종료1로 검출");

  reportBrowser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await reportBrowser.newPage();
  const reportPageErrors = [];
  page.on("pageerror", (error) => reportPageErrors.push(error.message));
  let reportAxeChecks = 0;
  for (const [name, directory, width] of [["good", goodDirectory, 1100], ["failure", failureDirectory, 390], ["qt", qtDirectory, 1100]]) {
    await page.setViewportSize({ width, height: 760 });
    await page.goto(pathToFileURL(join(directory, "report.html")).href, { waitUntil: "load" });
    assert.equal(await page.title(), "UI·UX 실행 검수");
    assert.equal(await page.locator("main h1").count(), 1);
    assert.equal(await page.locator("table thead th[scope=col]").count(), 3);
    assert.ok(await page.locator("tbody tr").count() > 0);
    await page.evaluate(axe.source);
    const scan = await page.evaluate(async () => {
      const scan = await globalThis.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
      return { violations: scan.violations.map((rule) => rule.id), incomplete: scan.incomplete.map((rule) => rule.id) };
    });
    assert.deepEqual(scan.violations, [], `${name} 보고서 자동 접근성 위반`);
    assert.deepEqual(scan.incomplete, [], `${name} 보고서 수동 확인 필요 항목`);
    reportAxeChecks++;
    if (name === "good" && process.env.REPLICA_TEST_EVIDENCE_DIR)
      reportPreview = await page.screenshot({ type: "png", fullPage: true });
    if (name === "failure") {
      assert.ok((await page.locator("tbody").innerText()).includes(injected));
      assert.equal(await page.locator("img,script").count(), 0);
      assert.equal(await page.evaluate(() => globalThis.__uiuxInjected), undefined);
    }
    // 보고서가 참조하는 파일 링크는 실제 파일이 있어야 한다.
    for (const href of await page.locator("a").evaluateAll((links) => links.map((link) => link.href)))
      assert.ok((await stat(fileURLToPath(href))).isFile());
  }
  assert.deepEqual(reportPageErrors, []);
  await reportBrowser.close();
  assert.equal(reportBrowser.isConnected(), false);
  reportBrowser = null;
  groups.push("실제 HTML 보고서 3종 렌더·axe 위반/미확인0·링크 유효성·HTML 주입 실행 방지");

  if (process.platform === "linux") {
    const deadline = Date.now() + 2000;
    while ((await runningOwnedProcesses()).length && Date.now() < deadline) await pause(50);
    assert.deepEqual(await runningOwnedProcesses(), [], "CLI 소유 자식 프로세스가 종료 뒤에도 실행 중입니다.");
    assert.ok(observedProcesses.size > 3);
  }
  assert.equal(launched.size, 0);
  groups.push("CLI 종료 및 Linux에서 관측한 소유 자식 프로세스 잔존0");
  const summary = { status: "PASS", suite: "uiux-cli", verification_groups: groups.length,
    checks: groups, report_accessibility_runs: reportAxeChecks,
    observed_owned_processes: observedProcesses.size, platform: process.platform,
    browser: goodResult.environment.browser, axe: goodResult.environment.axe,
    created_at: new Date().toISOString() };
  // 명시한 경우에만 합성 성공 예제와 요약을 보존하며 기존 증거는 덮어쓰지 않는다.
  if (process.env.REPLICA_TEST_EVIDENCE_DIR) {
    const evidenceDirectory = resolve(process.env.REPLICA_TEST_EVIDENCE_DIR);
    await mkdir(join(evidenceDirectory, "demo"), { recursive: true });
    await cp(goodDirectory, join(evidenceDirectory, "demo", "bundle"), { recursive: true, force: false, errorOnExist: true });
    await writeFile(join(evidenceDirectory, "demo", "report-preview.png"), reportPreview, { flag: "wx" });
    await writeFile(join(evidenceDirectory, "cli-e2e-summary.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  for (const child of launched) child.kill("SIGKILL");
  // 테스트가 시작 시각까지 기록한 자신의 자식만 정리하며 다른 세션 프로세스는 건드리지 않는다.
  for (const [pid, started] of observedProcesses) {
    const state = await processState(pid);
    if (state?.started === started && !["Z", "X"].includes(state.state)) {
      try { process.kill(pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
  }
  await reportBrowser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}

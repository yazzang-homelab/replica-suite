/* 합성 화면의 실제 Chromium 검사. 외부 서비스·계정·모델 호출을 사용하지 않는다. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runWebAudit } from "../lib/uiux-web.mjs";

const output = await mkdtemp(join(tmpdir(), "replica-uiux-e2e-"));
const executablePath = process.env.REPLICA_TEST_BROWSER_EXECUTABLE || undefined;
const passed = [];
let outsideHits = 0;
let outsideWebSockets = 0;
let echoedWebSocketMessages = 0;
const ownedSockets = new Set();
let streamsOpened = 0, streamsClosed = 0;
const outside = createServer((request, response) => {
  outsideHits++;
  if (new URL(request.url, "http://fixture").pathname === "/frame-bad") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(pageHTML('<input id="unlabelled">'));
    return;
  }
  response.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
  response.end("outside");
});
outside.on("upgrade", (request, socket, head) => {
  outsideWebSockets++;
  socket.on("error", () => {}); // 소유 브라우저 종료로 생기는 fixture TCP reset만 정리한다.
  const accept = createHash("sha1").update(request.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  let buffered = head;
  function receive(data) {
    if (data) buffered = Buffer.concat([buffered, data]);
    while (buffered.length >= 2) {
      const opcode = buffered[0] & 15;
      const masked = Boolean(buffered[1] & 128);
      const length = buffered[1] & 127;
      if (!masked || length >= 126) { socket.destroy(); return; }
      if (buffered.length < length + 6) return;
      if (opcode === 8) { socket.end(Buffer.from([0x88, 0])); return; }
      const payload = Buffer.from(buffered.subarray(6, 6 + length));
      for (let index = 0; index < payload.length; index++) payload[index] ^= buffered[2 + index % 4];
      buffered = buffered.subarray(6 + length);
      if (opcode === 1) {
        const text = Buffer.from(`허용된 WebSocket 메시지: ${payload.toString()}`);
        socket.write(Buffer.concat([Buffer.from([0x81, text.length]), text]));
        echoedWebSocketMessages++;
      }
    }
  }
  socket.on("data", receive);
  receive();
});
outside.on("connection", (socket) => { ownedSockets.add(socket); socket.once("close", () => ownedSockets.delete(socket)); });
await new Promise((resolve) => outside.listen(0, "127.0.0.1", resolve));
const outsideURL = `http://127.0.0.1:${outside.address().port}`;
const pageHTML = (body, script = "", css = "") => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UI·UX 검수 예제</title><style>body{font:18px Arial,sans-serif;background:#fff;color:#111;margin:24px}main{max-width:600px}button,input{font:inherit;min-height:40px;max-width:100%;box-sizing:border-box}button{background:#12365b;color:#fff;border:2px solid #12365b;padding:8px 16px}label{display:block;margin:8px 0}input{border:2px solid #222;padding:8px}button:focus-visible,input:focus-visible{outline:3px solid #111;outline-offset:3px}${css}</style></head><body><main><h1>UI·UX 검수</h1>${body}</main><script>${script}</script></body></html>`;
const form = '<label for="name">이름</label><input id="name" autocomplete="name"><button id="save">저장</button><p id="status" role="status">미저장</p><button id="open-dialog" data-testid="open-dialog">설정 열기</button><dialog id="settings" aria-labelledby="settings-title"><h2 id="settings-title">설정</h2><button id="close-dialog">설정 닫기</button></dialog>';
const formScript = `nameInput=document.getElementById('name'); nameInput.value=localStorage.getItem('name')||''; document.getElementById('save').onclick=()=>{localStorage.setItem('name',nameInput.value);document.getElementById('status').textContent='저장: '+nameInput.value}; if(nameInput.value)document.getElementById('status').textContent='저장: '+nameInput.value;document.getElementById('open-dialog').onclick=()=>document.getElementById('settings').showModal();document.getElementById('close-dialog').onclick=()=>document.getElementById('settings').close();`;
const server = createServer((request, response) => {
  const path = new URL(request.url, "http://fixture").pathname;
  if (path === "/redirect") {
    response.writeHead(302, { location: `${outsideURL}/redirect-target` });
    response.end();
    return;
  }
  if (path === "/redirect-good") {
    response.writeHead(302, { location: "/good" });
    response.end();
    return;
  }
  if (path === "/redirect-worker") {
    response.writeHead(302, { location: `${outsideURL}/worker-target` });
    response.end();
    return;
  }
  if (path === "/worker.js") {
    response.writeHead(200, { "content-type": "text/javascript" });
    response.end("fetch('/redirect-worker').then(response=>postMessage(response.ok?'도달함':'차단됨')).catch(()=>postMessage('차단됨'));");
    return;
  }
  if (path === "/events" || path === "/chunks") {
    response.writeHead(200, { "content-type": path === "/events" ? "text/event-stream" : "text/plain", "cache-control": "no-cache" });
    streamsOpened++;
    response.once("close", () => { streamsClosed++; });
    response.write(path === "/events" ? "data: ok\n\n" : "first");
    return; // 일부러 끝내지 않는 본문을 실제 브라우저에 점진적으로 전달해야 한다.
  }
  if (path === "/missing-resource") {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("없는 합성 리소스");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (path === "/good") response.end(pageHTML(form, formScript));
  else if (path === "/iframe") response.end(pageHTML('<iframe title="입력 프레임" src="/frame-bad"></iframe>'));
  else if (path === "/iframe-good") response.end(pageHTML('<iframe title="정상 입력 프레임" src="/frame-good"></iframe>'));
  else if (path === "/frame-bad") response.end(pageHTML('<input id="unlabelled">'));
  else if (path === "/frame-good") response.end(pageHTML('<label for="labelled">이름</label><input id="labelled">'));
  else if (path === "/iframe-cross") response.end(pageHTML(`<iframe title="외부 입력 프레임" src="${outsideURL}/frame-bad"></iframe>`));
  else if (path === "/sse") response.end(pageHTML('<p id="out" role="status">대기</p><p id="chunk" role="status">대기</p>', "new EventSource('/events').onmessage=e=>document.getElementById('out').textContent=e.data;fetch('/chunks').then(response=>response.body.getReader().read()).then(({value})=>document.getElementById('chunk').textContent=new TextDecoder().decode(value));"));
  else if (path === "/worker-redirect") response.end(pageHTML('<p id="out" role="status">대기</p>', "const worker=new Worker('/worker.js');worker.onmessage=e=>document.getElementById('out').textContent=e.data;"));
  else if (path === "/ws-allowed") response.end(pageHTML('<p id="out" role="status">대기</p>', `const socket=new WebSocket('${outsideURL.replace('http:', 'ws:')}/socket');socket.onopen=()=>socket.send('왕복 검수');socket.onmessage=e=>document.getElementById('out').textContent=e.data;`));
  else if (path === "/bad") response.end(pageHTML('<button id="bad"></button><p style="color:#bbb">낮은 대비</p>'));
  else if (path === "/overflow") response.end(pageHTML('<p id="content">넓은 콘텐츠</p>', "", "#content{width:900px}"));
  else if (path === "/network") response.end(pageHTML('<p id="content">네트워크 차단 검사</p>', `fetch('${outsideURL}/fetch').catch(()=>{});new WebSocket('${outsideURL.replace('http:', 'ws:')}/socket');`));
  else if (path === "/console") response.end(pageHTML('<p id="content">오류 검사</p>', "console.error('합성 오류');"));
  else if (path === "/pageerror") response.end(pageHTML('<p id="content">예외 검사</p>', "throw new Error('합성 페이지 예외');"));
  else if (path === "/http-error") response.end(pageHTML('<p id="content">HTTP 오류 검사</p><img src="/missing-resource" alt="합성 이미지">'));
  else if (path === "/small") response.end(pageHTML('<button id="tiny" aria-label="작은 버튼"></button>', "", "#tiny{min-height:10px;width:10px;height:10px;padding:0;border:0}"));
  else if (path === "/incomplete") response.end(pageHTML('<p id="content" style="color:#777;position:absolute;top:0;left:0">수동 대비 확인</p>', "", "body{background:linear-gradient(#fff,#000);min-height:600px}"));
  else response.end(pageHTML('<p id="content">기본 화면</p>'));
});
server.on("connection", (socket) => { ownedSockets.add(socket); socket.once("close", () => ownedSockets.delete(socket)); });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const viewports = [{ name: "desktop", width: 1000, height: 700 }, { name: "mobile", width: 360, height: 640 }];
const contract = (path, extra = [], selectedViewports = [viewports[0]]) => ({
  schema_version: 1,
  project: { name: "합성 검수", platform: "web", locale: "ko-KR" },
  viewports: selectedViewports,
  flows: [{ id: "sample", title: "합성 흐름", steps: [
    { action: "goto", path }, ...extra,
    { action: "assert-visible", target: { role: "heading", name: "UI·UX 검수" } },
  ] }],
});
async function audit(name, spec, options = {}) {
  return runWebAudit({ contract: spec, baseUrl, outDir: join(output, name), executablePath, timeoutMs: 10000, ...options });
}
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function verifiesArtifacts(name, result) {
  assert.ok(result.artifacts.length > 0);
  for (const artifact of result.artifacts) {
    assert.match(artifact.path, /^web\/v\d+-f\d+-s\d+\.(png|axe\.json)$/);
    const bytes = await readFile(join(output, name, artifact.path));
    assert.equal(sha(bytes), artifact.sha256);
    assert.equal(bytes.length, artifact.bytes);
    if (artifact.path.endsWith(".png"))
      assert.deepEqual(bytes.subarray(0, 8), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    else assert.ok(Array.isArray(JSON.parse(bytes).violations));
  }
}
try {
  const save = contract("/good", [
    { action: "fill", target: { role: "textbox", name: "이름" }, value: "검증 사용자" },
    { action: "click", target: { role: "button", name: "저장" } },
    { action: "assert-text", target: { selector: "#status" }, text: "저장: 검증 사용자" },
    { action: "reload" },
    { action: "assert-text", target: { selector: "#status" }, text: "저장: 검증 사용자" },
  ], viewports);
  // 별도 flow에 이전 flow의 저장소가 유출되지 않는지 실제 상태로 검증한다.
  save.flows.push({ id: "isolated", title: "흐름 격리", steps: [
    { action: "goto", path: "/good" },
    { action: "assert-text", target: { selector: "#status" }, text: "미저장" },
  ] });
  const good = await audit("good", save);
  assert.equal(good.status, "pass", JSON.stringify(good.checks.filter((check) => check.status !== "pass")));
  assert.equal(good.checks.filter((check) => check.kind === "flow" && check.status === "pass").length, 4);
  assert.equal(good.checks.find((check) => check.id === "web.browser.cleanup").status, "pass");
  await verifiesArtifacts("good", good);
  passed.push("두 viewport 저장·재로드 및 flow context 격리, PNG/axe JSON SHA-256");

  const keyboard = await audit("keyboard", contract("/good", [
    { action: "press", target: { test_id: "open-dialog" }, key: "Enter" },
    { action: "assert-visible", target: { role: "dialog", name: "설정" } },
    { action: "press", target: { role: "button", name: "설정 닫기" }, key: "Escape" },
    { action: "assert-hidden", target: { selector: "#settings" } },
  ]));
  assert.equal(keyboard.status, "pass", JSON.stringify(keyboard.checks.filter((check) => check.status !== "pass")));
  passed.push("test_id 및 키보드 Enter/Escape로 dialog 열기·닫기, assert-hidden 검증");

  const bad = await audit("bad", contract("/bad"));
  assert.equal(bad.status, "fail");
  assert.ok(bad.checks.some((check) => check.violations?.includes("button-name")));
  assert.ok(bad.checks.some((check) => check.violations?.includes("color-contrast")));
  passed.push("이름 없는 버튼·낮은 대비의 자동 접근성 위반 검출");

  const failureSpec = contract("/good", [
    { action: "assert-text", target: { selector: "#status" }, text: "존재하지 않는 저장 결과" },
    { action: "click", target: { role: "button", name: "저장" } },
  ]);
  failureSpec.flows.push({ id: "next", title: "다음 흐름 계속", steps: [
    { action: "goto", path: "/good" },
    { action: "assert-text", target: { selector: "#status" }, text: "미저장" },
  ] });
  const failure = await audit("failure", failureSpec);
  assert.equal(failure.status, "fail");
  assert.ok(failure.checks.some((check) => check.kind === "flow" && check.flow === "next" && check.status === "pass"),
    JSON.stringify(failure.checks.filter((check) => check.status !== "pass"), null, 2));
  assert.ok(failure.checks.some((check) => check.id === "web.v0.f0.step2" && check.status === "incomplete"));
  passed.push("assertion 실패 및 미실행 단계 판정, 다음 flow 계속 실행");

  const overflow = await audit("overflow", contract("/overflow", [], [viewports[1]]));
  assert.equal(overflow.status, "fail");
  assert.ok(overflow.checks.some((check) => check.kind === "layout" && check.status === "fail"));
  passed.push("모바일 viewport 가로 넘침 검출");

  const network = await audit("network", contract("/network"));
  assert.equal(network.status, "fail");
  assert.equal(outsideHits, 0);
  assert.ok(network.checks.some((check) => check.kind === "network" &&
    check.evidence.some((event) => event.kind === "origin") && check.evidence.some((event) => event.kind === "websocket")));
  const redirect = await audit("redirect", contract("/redirect"));
  assert.equal(redirect.status, "fail");
  assert.equal(outsideHits, 0, "HTTP redirect가 origin 필터를 우회했습니다.");
  assert.ok(redirect.checks.some((check) => check.kind === "network" && check.evidence.some((event) => event.kind === "redirect")));
  const workerRedirect = await audit("worker-redirect", contract("/worker-redirect", [
    { action: "assert-text", target: { selector: "#out" }, text: "차단됨" },
  ]));
  assert.equal(workerRedirect.status, "fail");
  assert.equal(outsideHits, 0, "worker HTTP redirect가 origin 필터를 우회했습니다.");
  assert.equal(outsideWebSockets, 0);
  assert.ok(workerRedirect.checks.some((check) => check.kind === "network" && check.evidence.some((event) => event.kind === "redirect")));
  passed.push("외부 HTTP·WebSocket·redirect 요청이 실제 목적지에 도달하기 전 차단");

  const allowedRedirect = await audit("allowed-redirect", contract("/redirect-good"));
  assert.equal(allowedRedirect.status, "pass", JSON.stringify(allowedRedirect.checks.filter((check) => check.status !== "pass")));
  assert.ok(allowedRedirect.checks.some((check) => check.id.endsWith(".proxy") && check.evidence.http_requests >= 2));
  passed.push("허용 origin redirect는 유지하고 worker redirect의 외부 목적지 도달 차단");

  const allowed = await audit("allow-origin", contract("/network"), { allowOrigins: [outsideURL] });
  assert.ok(outsideHits > 0);
  assert.ok(allowed.checks.some((check) => check.kind === "network" && check.status === "pass"),
    JSON.stringify(allowed.checks.filter((check) => check.status !== "pass"), null, 2));
  passed.push("명시 allowOrigins의 HTTP 요청 허용");

  const allowedSocket = await audit("allow-websocket", contract("/ws-allowed", [
    { action: "assert-text", target: { selector: "#out" }, text: "허용된 WebSocket 메시지: 왕복 검수" },
  ]), { allowOrigins: [outsideURL] });
  assert.equal(allowedSocket.status, "pass", JSON.stringify(allowedSocket.checks.filter((check) => check.status !== "pass")));
  assert.ok(outsideWebSockets > 0);
  assert.ok(echoedWebSocketMessages > 0);
  assert.ok(allowedSocket.checks.some((check) => check.id.endsWith(".proxy") &&
    check.evidence.websocket_upgrades + check.evidence.websocket_connects > 0));
  passed.push("허용한 WebSocket upgrade와 실제 메시지 왕복을 프록시를 통해 검증");

  const badFrame = await audit("iframe", contract("/iframe"));
  assert.equal(badFrame.status, "fail");
  assert.ok(badFrame.checks.some((check) => check.kind === "a11y" && check.violations.includes("label") && check.inspected_frames === 2));
  const goodFrame = await audit("iframe-good", contract("/iframe-good"));
  assert.equal(goodFrame.status, "pass", JSON.stringify(goodFrame.checks.filter((check) => check.status !== "pass")));
  const crossFrame = await audit("iframe-cross", contract("/iframe-cross"), { allowOrigins: [outsideURL] });
  assert.equal(crossFrame.status, "fail");
  assert.ok(crossFrame.checks.some((check) => check.kind === "a11y" && check.violations.includes("label") && check.inspected_frames === 2));
  passed.push("같은 origin·명시 허용한 cross-origin iframe 입력 이름 위반 검출 및 정상 frame 통과");

  const streaming = await audit("streaming", contract("/sse", [
    { action: "assert-text", target: { selector: "#out" }, text: "ok" },
    { action: "assert-text", target: { selector: "#chunk" }, text: "first" },
  ]));
  assert.equal(streaming.status, "pass", JSON.stringify(streaming.checks.filter((check) => check.status !== "pass")));
  assert.equal(streamsOpened, 2);
  const streamDeadline = Date.now() + 2000;
  while (streamsClosed !== streamsOpened && Date.now() < streamDeadline)
    await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(streamsClosed, streamsOpened);
  assert.ok(streaming.checks.some((check) => check.id.endsWith(".proxy") && check.evidence.http_requests >= 3));
  passed.push("끝나지 않는 SSE·fetch 본문을 점진적으로 수신하고 종료 때 upstream 연결 정리");

  const consoleResult = await audit("console", contract("/console"));
  assert.equal(consoleResult.status, "fail");
  assert.ok(consoleResult.checks.some((check) => check.kind === "runtime" && check.evidence?.errors?.some((event) => event.message === "합성 오류")));
  const pageError = await audit("pageerror", contract("/pageerror"));
  assert.equal(pageError.status, "fail");
  assert.ok(pageError.checks.some((check) => check.kind === "runtime" && check.evidence?.errors?.some((event) => event.type === "pageerror" && event.message === "합성 페이지 예외")));
  const httpError = await audit("http-error", contract("/http-error"));
  assert.equal(httpError.status, "fail");
  assert.ok(httpError.checks.some((check) => check.kind === "runtime" && check.evidence?.http_errors?.some((event) => event.status === 404)));
  passed.push("console.error·pageerror·HTTP 오류 수집 및 실패 판정");

  const small = await audit("small", contract("/small"));
  assert.equal(small.status, "pass", JSON.stringify(small.checks.filter((check) => check.status !== "pass"), null, 2));
  assert.ok(small.checks.some((check) => check.kind === "advisory" && check.evidence.length === 1 && check.status === "pass"));
  passed.push("작은 조작 대상 권고를 WCAG 위반과 구분");

  const incomplete = await audit("incomplete", contract("/incomplete"));
  assert.equal(incomplete.status, "incomplete");
  assert.ok(incomplete.checks.some((check) => check.kind === "a11y" && check.incomplete?.includes("color-contrast")));
  passed.push("axe 수동 확인 항목을 통과로 처리하지 않음");

  await assert.rejects(audit("empty", { ...save, flows: [] }), /flow/);
  await assert.rejects(audit("no-assert", { ...save, flows: [{ id: "empty", steps: [{ action: "goto", path: "/" }] }] }), /assert/);
  await assert.rejects(audit("escape", contract(`${outsideURL}/`)), /상대 경로/);
  await assert.rejects(audit("backslash", contract(`/\\127.0.0.1/`)), /상대 경로/);
  await assert.rejects(audit("zero-timeout", save, { timeoutMs: 0 }), /timeoutMs/);
  const unavailable = await audit("missing-browser", contract("/good"), { executablePath: join(output, "missing-browser") });
  assert.equal(unavailable.status, "incomplete");
  assert.ok(unavailable.checks.some((check) => check.id === "web.browser.execution" && check.status === "incomplete"));
  passed.push("잘못된 입력 거부 및 브라우저 누락을 미검증으로 보고");

  // 모든 실행은 정리 check를 남기며 서버 종료는 테스트 자신의 소유 프로세스만 다룬다.
  for (const result of [good, keyboard, bad, failure, overflow, network, redirect, workerRedirect, allowedRedirect,
    allowed, allowedSocket, badFrame, goodFrame, crossFrame, streaming, consoleResult, pageError, httpError, small, incomplete])
    assert.equal(result.checks.find((check) => check.id === "web.browser.cleanup")?.status, "pass");
  assert.ok((await readdir(output)).includes("good"));
  console.log(JSON.stringify({ status: "PASS", suite: "uiux-web", assertions: passed.length, checks: passed,
    browser: good.environment.browser, axe: good.environment.axe }, null, 2));
} finally {
  for (const socket of ownedSockets) socket.destroy();
  server.closeAllConnections();
  outside.closeAllConnections();
  await Promise.all([new Promise((resolve) => server.close(resolve)), new Promise((resolve) => outside.close(resolve))]);
  await rm(output, { recursive: true, force: true });
}

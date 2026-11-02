/* 소유 forward proxy의 스트리밍·origin·CONNECT·정리 검증. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request } from "node:http";
import { connect, createServer as createTCPServer } from "node:net";
import { test } from "node:test";
import { startOriginProxy } from "../lib/uiux-proxy.mjs";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
function connections(server) {
  const sockets = new Set();
  server.on("connection", (socket) => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  return sockets;
}
async function close(server, sockets) {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
}
async function firstChunk(proxy, target) {
  return new Promise((resolve, reject) => {
    const url = new URL(proxy.settings.server);
    const upstream = request({ hostname: url.hostname, port: url.port, path: target, method: "GET", agent: false }, (response) => {
      response.once("data", (data) => { resolve({ status: response.statusCode, data: data.toString() }); upstream.destroy(); });
      response.once("error", reject);
    });
    upstream.setTimeout(10000, () => upstream.destroy(new Error("시험 요청 제한 초과")));
    upstream.once("error", reject);
    upstream.end();
  });
}
async function tunnel(proxy, authority, payload) {
  const url = new URL(proxy.settings.server);
  const socket = connect(Number(url.port), url.hostname);
  socket.setTimeout(30000, () => socket.destroy(new Error("CONNECT 시험 제한 초과")));
  await once(socket, "connect");
  let buffer = Buffer.alloc(0), headers;
  try {
    socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    for await (const chunk of socket) {
      buffer = Buffer.concat([buffer, chunk]);
      if (!headers) {
        const index = buffer.indexOf("\r\n\r\n");
        if (index < 0) continue;
        headers = buffer.subarray(0, index).toString();
        buffer = buffer.subarray(index + 4);
        if (!headers.startsWith("HTTP/1.1 200") || payload === undefined) return { headers, body: buffer.toString() };
        socket.write(payload);
      }
      if (buffer.length && buffer.toString() === payload) return { headers, body: buffer.toString() };
    }
    return { headers, body: buffer.toString() };
  } catch (error) {
    // 거부된 TLS·잘못된 handshake를 즉시 끊으면 운영체제가 RST로 종료할 수 있다.
    if (error.code === "ECONNRESET" && headers?.startsWith("HTTP/1.1 200"))
      return { headers, body: buffer.toString(), closed: "reset" };
    throw error;
  } finally { socket.destroy(); }
}

test("HTTP 본문이 끝나기 전 첫 SSE chunk를 전달하고 소유 연결을 닫는다", async () => {
  let ended = false;
  let closed;
  const closedResponse = new Promise((resolve) => { closed = resolve; });
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write("data: first\n\n");
    response.once("close", () => { ended = true; closed(); });
  });
  const sockets = connections(server);
  const origin = await listen(server);
  const errors = [];
  const proxy = await startOriginProxy({ origins: [origin], onError: (error) => errors.push(error) });
  try {
    const response = await firstChunk(proxy, `${origin}/events`);
    assert.equal(response.status, 200);
    assert.equal(response.data, "data: first\n\n");
    assert.equal(proxy.stats.http_requests, 1);
    await proxy.close();
    assert.deepEqual(errors, []);
    let guard;
    try {
      await Promise.race([closedResponse, new Promise((_, reject) => {
        guard = setTimeout(() => reject(new Error("SSE upstream 연결이 정리되지 않았습니다.")), 2000);
      })]);
    } finally { clearTimeout(guard); }
    await assert.rejects(once(connect(Number(new URL(proxy.settings.server).port), "127.0.0.1"), "connect"), (error) => error.code === "ECONNREFUSED");
  } finally { await proxy.close(); await close(server, sockets); }
  assert.equal(ended, true);
});

test("직접 외부 요청과 HTTP redirect를 목적지 연결 전에 차단한다", async () => {
  let outsideHits = 0;
  const outside = createServer((_request, response) => { outsideHits++; response.end("outside"); });
  const outsideSockets = connections(outside);
  const outsideOrigin = await listen(outside);
  const originServer = createServer((_request, response) => { response.writeHead(302, { Location: `${outsideOrigin}/escape` }); response.end(); });
  const originSockets = connections(originServer);
  const origin = await listen(originServer);
  const blocks = [];
  const proxy = await startOriginProxy({ origins: [origin], onBlock: (block) => blocks.push(block) });
  try {
    assert.equal((await firstChunk(proxy, `${outsideOrigin}/direct`)).status, 403);
    assert.equal((await firstChunk(proxy, `${origin}/redirect`)).status, 403);
    assert.equal(outsideHits, 0);
    assert.deepEqual(blocks.map((block) => block.kind), ["origin", "redirect"]);
  } finally { await proxy.close(); await close(originServer, originSockets); await close(outside, outsideSockets); }
});

test("CONNECT는 허용 HTTPS origin host/port만 터널링하고 다른 포트는 연결하지 않는다", async () => {
  let allowedHits = 0, outsideHits = 0;
  const allowed = createTCPServer((socket) => { allowedHits++; socket.pipe(socket); });
  const denied = createTCPServer((socket) => { outsideHits++; socket.destroy(); });
  const allowedSockets = connections(allowed), deniedSockets = connections(denied);
  await listen(allowed);
  await listen(denied);
  const authority = `127.0.0.1:${allowed.address().port}`;
  const blockedAuthority = `127.0.0.1:${denied.address().port}`;
  const blocks = [];
  const proxy = await startOriginProxy({ origins: [`https://${authority}`], onBlock: (block) => blocks.push(block) });
  try {
    const result = await tunnel(proxy, authority, "연결 시험");
    assert.match(result.headers, /^HTTP\/1\.1 200/);
    assert.equal(result.body, "연결 시험");
    assert.match((await tunnel(proxy, blockedAuthority)).headers, /^HTTP\/1\.1 403/);
    assert.equal(allowedHits, 1);
    assert.equal(outsideHits, 0);
    assert.equal(proxy.stats.connect_tunnels, 1);
    assert.equal(blocks[0].kind, "connect");
  } finally { await proxy.close(); await close(allowed, allowedSockets); await close(denied, deniedSockets); }
});

test("등록한 plain WebSocket CONNECT도 TLS·Host 불일치·일반 HTTP·과대 헤더를 상류 연결 전에 차단한다", async () => {
  let hits = 0;
  const endpoint = createTCPServer((socket) => { hits++; socket.pipe(socket); });
  const sockets = connections(endpoint);
  const origin = await listen(endpoint);
  const authority = new URL(origin).host;
  const blocks = [];
  const proxy = await startOriginProxy({ origins: [origin], timeoutMs: 5000, onBlock: (event) => blocks.push(event) });
  const handshake = (host = authority, connection = "Upgrade", path = "/socket") =>
    `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: ${connection}\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${Buffer.alloc(16, 1).toString("base64")}\r\n\r\n`;
  try {
    assert.match((await tunnel(proxy, authority)).headers, /^HTTP\/1\.1 403/);
    assert.equal(hits, 0);
    proxy.authorizeWebSocket(`ws://${authority}/socket`);
    const valid = handshake();
    assert.equal((await tunnel(proxy, authority, valid)).body, valid);
    assert.equal(hits, 1);
    assert.equal(proxy.stats.websocket_connects, 1);
    const payloads = [
      Buffer.from([0x16, 0x03, 0x03, 0x00]),
      handshake("wrong.example.invalid:443"),
      handshake(authority, "keep-alive"),
      handshake(authority, "Upgrade", `http://${authority}/socket`),
      handshake(authority, "Upgrade", "//wrong.example.invalid/socket"),
      `GET / HTTP/1.1\r\nHost: ${authority}\r\n\r\n`,
      `POST / HTTP/1.1\r\nHost: ${authority}\r\n\r\n`,
      `GET / HTTP/1.1\r\nHost: ${authority}\r\nX-Oversize: ${"a".repeat(16384)}\r\n\r\n`,
      "", // CONNECT 200을 받은 뒤 payload를 보내지 않아도 유한 시간 안에 닫아야 한다.
    ];
    for (const payload of payloads) {
      const outcome = await tunnel(proxy, authority, payload);
      assert.equal(outcome.body, "");
      assert.equal(hits, 1, "허용되지 않은 CONNECT payload가 상류 TCP 연결을 만들었습니다.");
    }
    assert.equal(blocks.length, payloads.length + 1);
    assert.ok(blocks.slice(1).every((event) => event.kind === "websocket-connect"));
  } finally { await proxy.close(); await close(endpoint, sockets); }
});

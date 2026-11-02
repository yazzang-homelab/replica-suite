/* 감사가 소유하는 loopback 프록시. origin 검사는 매 요청, 본문은 스트리밍한다. */
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect } from "node:net";

const HOP_HEADERS = new Set(["connection", "proxy-connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

function headersFor(headers, upgrade = false) {
  const omitted = new Set(HOP_HEADERS);
  for (const name of String(headers.connection ?? "").split(",")) omitted.add(name.trim().toLowerCase());
  if (upgrade) { omitted.delete("connection"); omitted.delete("upgrade"); }
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !omitted.has(name.toLowerCase())));
}
function redacted(url) { return `${url.origin}${url.pathname}`; }
function normalizeURL(value, host) {
  const url = new URL(value, `http://${host}`);
  if (["ws:", "wss:"].includes(url.protocol)) url.protocol = url.protocol === "ws:" ? "http:" : "https:";
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("인증정보 없는 HTTP(S) 요청만 허용합니다.");
  return url;
}

/** 종료 시 이 인스턴스가 만든 listener와 TCP socket만 닫는다. */
export async function startOriginProxy({ origins, timeoutMs = 15000, onBlock = () => {}, onError = () => {} }) {
  const allowed = new Set(origins);
  const sockets = new Set();
  const requests = new Set();
  const plainWebSocketAuthorities = new Set();
  const stats = { http_requests: 0, connect_tunnels: 0, websocket_upgrades: 0, websocket_connects: 0, blocked_requests: 0 };
  let closing = false;
  let closePromise;
  const track = (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    // pipe 연결이 닫히는 동안의 소켓 오류를 프로세스 오류로 전파하지 않는다.
    socket.on("error", () => {});
    return socket;
  };
  const block = (event) => { stats.blocked_requests++; if (!closing) onBlock(event); };
  const failure = (error) => { if (!closing) onError(String(error?.message ?? error).slice(0, 4000)); };
  function authorize(request) {
    const url = normalizeURL(request.url, request.headers.host);
    if (!allowed.has(url.origin)) {
      block({ kind: "origin", url: redacted(url), transport: "proxy" });
      return null;
    }
    return url;
  }
  function denied(response, status = 403) {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end("UI·UX 감사의 origin 정책으로 요청을 차단했습니다.");
  }
  const server = createServer((incoming, outgoing) => {
    let target;
    try { target = authorize(incoming); }
    catch (error) { block({ kind: "invalid-request", url: "형식이 잘못된 프록시 요청", transport: "proxy" }); return denied(outgoing); }
    if (!target) return denied(outgoing);
    stats.http_requests++;
    let responded = false;
    const upstream = (target.protocol === "https:" ? httpsRequest : httpRequest)(target, {
      method: incoming.method, headers: { ...headersFor(incoming.headers), host: target.host }, agent: false,
    });
    requests.add(upstream);
    upstream.once("close", () => requests.delete(upstream));
    upstream.once("socket", track);
    // 응답 시작까지만 제한한다. 시작된 SSE/스트리밍 본문에는 전체 버퍼·완료 대기가 없다.
    const timer = setTimeout(() => upstream.destroy(new Error("프록시 응답 헤더 대기 제한 초과")), timeoutMs);
    upstream.once("close", () => clearTimeout(timer));
    upstream.once("response", (response) => {
      clearTimeout(timer);
      try {
        const location = response.headers.location;
        if (response.statusCode >= 300 && response.statusCode < 400 && location) {
          let destination;
          try { destination = normalizeURL(new URL(location, target).href); } catch { /* 잘못된 redirect도 차단한다. */ }
          if (!destination || !allowed.has(destination.origin)) {
            block({ kind: "redirect", url: redacted(target), destination: destination ? redacted(destination) : "잘못된 이동 경로",
              status: response.statusCode, transport: "proxy" });
            response.destroy();
            responded = true;
            denied(outgoing);
            return;
          }
        }
        responded = true;
        outgoing.writeHead(response.statusCode, headersFor(response.headers));
        outgoing.flushHeaders();
        response.on("error", (error) => {
          if (!outgoing.destroyed) { failure(error); outgoing.destroy(); }
        });
        response.pipe(outgoing);
      } catch (error) {
        failure(error);
        response.destroy();
        if (!outgoing.headersSent) denied(outgoing, 502);
        else outgoing.destroy();
      }
    });
    upstream.on("error", (error) => {
      clearTimeout(timer);
      if (outgoing.destroyed || closing) return;
      failure(error);
      if (!responded && !outgoing.headersSent) denied(outgoing, 502);
      else outgoing.destroy();
    });
    incoming.once("aborted", () => upstream.destroy());
    outgoing.once("close", () => { if (!outgoing.writableFinished) upstream.destroy(); });
    incoming.pipe(upstream);
  });
  server.on("connection", track);
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("connect", (incoming, client, head) => {
    let target;
    let secureAllowed;
    try {
      if (/[\/?#@\s]/.test(incoming.url)) throw new Error("잘못된 CONNECT authority");
      target = new URL(`https://${incoming.url}`);
      secureAllowed = allowed.has(target.origin);
      const authority = `${target.hostname}:${target.port || 443}`;
      if (target.username || target.password || (!secureAllowed && !plainWebSocketAuthorities.has(authority))) {
        block({ kind: "connect", url: target.origin, transport: "proxy" });
        client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
        return;
      }
    } catch {
      block({ kind: "connect", url: "잘못된 CONNECT authority", transport: "proxy" });
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    function openTunnel(payload, plainWebSocket = false) {
      const host = target.hostname.replace(/^\[|\]$/g, "");
      const upstream = track(connect({ host, port: Number(target.port || 443) }));
      const timer = setTimeout(() => upstream.destroy(new Error("CONNECT 연결 대기 제한 초과")), timeoutMs);
      upstream.once("connect", () => {
        clearTimeout(timer);
        if (closing || client.destroyed) return upstream.destroy();
        stats.connect_tunnels++;
        if (plainWebSocket) stats.websocket_connects++;
        else client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (payload.length) upstream.write(payload);
        upstream.pipe(client);
        client.pipe(upstream);
        client.resume();
      });
      upstream.once("error", (error) => {
        clearTimeout(timer);
        if (!client.destroyed) { failure(error); client.destroy(); }
      });
      client.once("close", () => { clearTimeout(timer); upstream.destroy(); });
      upstream.once("close", () => client.destroy());
    }
    if (secureAllowed) { openTunnel(head); return; }

    // Chromium의 plain ws도 CONNECT를 사용한다. 등록된 authority라도 TLS나 일반 HTTP는
    // 통과시키지 않고, 실제 WebSocket 요청 헤더를 검증한 다음에만 상류에 연결한다.
    const expectedOrigin = new URL(`http://${target.hostname}:${target.port || 443}`).origin;
    let buffered = head;
    let waiting = true;
    function stopWaiting() {
      waiting = false;
      clearTimeout(timer);
      client.removeListener("data", inspectPayload);
    }
    function rejectPayload(reason) {
      if (!waiting) return;
      stopWaiting();
      block({ kind: "websocket-connect", url: expectedOrigin, reason, transport: "proxy" });
      client.destroy();
    }
    function inspectPayload(chunk) {
      if (!waiting) return;
      if (chunk) buffered = Buffer.concat([buffered, chunk]);
      if (!buffered.length) return;
      if (buffered[0] !== 0x47) return rejectPayload("등록된 plain WebSocket CONNECT에서 TLS·다른 payload를 차단했습니다.");
      const end = buffered.indexOf("\r\n\r\n");
      if ((end < 0 && buffered.length > 16384) || end + 4 > 16384)
        return rejectPayload("WebSocket 헤더가 16 KiB 제한을 넘었습니다.");
      if (end < 0) return;
      const lines = buffered.subarray(0, end).toString("latin1").split("\r\n");
      const first = /^GET (\/[^\s]*) HTTP\/1\.1$/.exec(lines.shift());
      const headers = new Map();
      for (const line of lines) {
        const parsed = /^([^:\s]+):[ \t]*(.*)$/.exec(line);
        if (!parsed || headers.has(parsed[1].toLowerCase())) return rejectPayload("WebSocket 헤더 형식 또는 중복이 잘못되었습니다.");
        headers.set(parsed[1].toLowerCase(), parsed[2].trim());
      }
      try {
        if (!first || first[1].startsWith("//") || first[1].includes("\\") ||
            headers.get("upgrade")?.toLowerCase() !== "websocket" ||
            !headers.get("connection")?.toLowerCase().split(",").map((value) => value.trim()).includes("upgrade") ||
            normalizeURL(`http://${headers.get("host")}`).origin !== expectedOrigin)
          return rejectPayload("WebSocket GET·Upgrade·Connection·Host 조건이 일치하지 않습니다.");
      } catch { return rejectPayload("WebSocket Host 형식이 잘못되었습니다."); }
      stopWaiting();
      client.pause();
      openTunnel(buffered, true);
    }
    const timer = setTimeout(() => rejectPayload("WebSocket 초기 헤더 대기 제한을 넘었습니다."), timeoutMs);
    client.once("close", stopWaiting);
    client.on("data", inspectPayload);
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    inspectPayload();
  });
  server.on("upgrade", (incoming, client, head) => {
    let target;
    try { target = authorize(incoming); } catch { target = null; }
    if (!target) {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    const upstream = (target.protocol === "https:" ? httpsRequest : httpRequest)(target, {
      method: incoming.method, headers: { ...headersFor(incoming.headers, true), host: target.host }, agent: false,
    });
    requests.add(upstream);
    upstream.once("close", () => requests.delete(upstream));
    upstream.once("socket", track);
    const timer = setTimeout(() => upstream.destroy(new Error("WebSocket upgrade 대기 제한 초과")), timeoutMs);
    upstream.once("close", () => clearTimeout(timer));
    upstream.once("upgrade", (response, socket, upstreamHead) => {
      clearTimeout(timer);
      track(socket);
      if (closing || client.destroyed) return socket.destroy();
      stats.websocket_upgrades++;
      const headers = headersFor(response.headers, true);
      const lines = Object.entries(headers).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((item) => `${name}: ${item}`));
      client.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${lines.join("\r\n")}\r\n\r\n`);
      if (head.length) socket.write(head);
      if (upstreamHead.length) client.write(upstreamHead);
      socket.pipe(client);
      client.pipe(socket);
      socket.once("close", () => client.destroy());
      client.once("close", () => socket.destroy());
    });
    upstream.once("response", (response) => {
      clearTimeout(timer);
      response.destroy();
      client.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    });
    upstream.once("error", (error) => {
      clearTimeout(timer);
      if (!client.destroyed) { failure(error); client.destroy(); }
    });
    client.once("close", () => { clearTimeout(timer); upstream.destroy(); });
    upstream.end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
  });
  return {
    settings: { server: `http://127.0.0.1:${server.address().port}`, bypass: "<-loopback>" },
    stats,
    authorizeWebSocket(value) {
      const url = new URL(value);
      if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password)
        throw new Error("유효한 WebSocket URL이 필요합니다.");
      const httpOrigin = normalizeURL(url.href).origin;
      if (!allowed.has(httpOrigin)) throw new Error("허용하지 않은 WebSocket origin입니다.");
      if (url.protocol === "ws:") plainWebSocketAuthorities.add(`${url.hostname}:${url.port || 80}`);
    },
    close() {
      if (closePromise) return closePromise;
      closing = true;
      closePromise = new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        for (const request of requests) request.destroy();
        for (const socket of sockets) socket.destroy();
        server.closeAllConnections();
      });
      return closePromise;
    },
  };
}

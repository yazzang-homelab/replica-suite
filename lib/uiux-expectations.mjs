/** 기대한 오류만 정확한 origin·경로·상태·횟수로 소비한다. 나머지 오류는 보존한다. */
const location = (value, base) => {
  try { const url = new URL(value); return url.origin === base.origin ? url.pathname : null; }
  catch { return null; }
};

export function assessExpectedEvents({flow, baseUrl, httpErrors = [], runtimeErrors = [], dialogs = []}) {
  const base = new URL(baseUrl);
  const expectedHttp = (flow.expected_http ?? []).map(entry => ({...entry, limit: entry.count ?? 1, seen: 0}));
  const expectedConsole = (flow.expected_console_errors ?? []).map(entry => ({...entry, limit: entry.count ?? 1, seen: 0}));
  const unexpectedHttp = [], unexpectedRuntime = [], checks = [];
  const automaticConsoleBudget = new Map();
  for (const response of httpErrors) {
    const path = location(response.url, base);
    const expected = expectedHttp.find(entry => entry.method === response.method && entry.path === path && entry.status === response.status && entry.seen < entry.limit);
    if (!expected) {unexpectedHttp.push(response); continue;}
    expected.seen++;
    const key = JSON.stringify([path, response.status]);
    automaticConsoleBudget.set(key, (automaticConsoleBudget.get(key) ?? 0) + 1);
  }
  for (const error of runtimeErrors) {
    if (error.type !== 'console.error' || error.truncated === true) {unexpectedRuntime.push(error); continue;}
    const expected = expectedConsole.find(entry => entry.message === error.message && entry.seen < entry.limit);
    if (expected) {expected.seen++; continue;}
    // Chromium이 실패 응답마다 만든 자원 오류 로그만 대응되는 실제 HTTP 관측과 연결한다.
    // 비슷한 앱 로그·pageerror·다른 origin·초과 횟수는 이 경로에서 허용하지 않는다.
    const match = /^Failed to load resource: the server responded with a status of (\d{3})(?: \(.*\))?$/.exec(error.message);
    const path = location(error.url, base);
    const key = JSON.stringify([path, Number(match?.[1])]);
    if (match && path && (automaticConsoleBudget.get(key) ?? 0) > 0) {
      automaticConsoleBudget.set(key, automaticConsoleBudget.get(key) - 1);
      continue;
    }
    unexpectedRuntime.push(error);
  }
  for (const [i, entry] of expectedHttp.entries()) checks.push({id:`expected.http.${i}`,status:entry.seen===entry.limit?'pass':'fail',
    message:`기대 HTTP ${entry.method} ${entry.path} ${entry.status}: 관측 ${entry.seen}/${entry.limit}회.`, evidence:{expected:entry.limit,observed:entry.seen}});
  for (const [i, entry] of expectedConsole.entries()) checks.push({id:`expected.console.${i}`,status:entry.seen===entry.limit?'pass':'fail',
    message:`기대 console.error: 관측 ${entry.seen}/${entry.limit}회.`,evidence:{message:entry.message,expected:entry.limit,observed:entry.seen}});
  const expectedDialogs = flow.dialogs ?? [];
  for (let i = 0; i < Math.max(dialogs.length, expectedDialogs.length); i++) {
    const expected = expectedDialogs[i], observed = dialogs[i];
    const pass = Boolean(expected && observed && observed.type === expected.type && observed.message === expected.message && observed.action === expected.action && observed.settled === true && !observed.error);
    checks.push({id:`expected.dialog.${i}`,status:pass?'pass':'fail',message:pass?'명시한 native dialog를 지정한 동작으로 처리했습니다.':'native dialog가 계약과 다르거나 발생·처리 완료를 확인하지 못했습니다.', evidence:{expected:expected??null,observed:observed??null}});
  }
  return {unexpectedHttp, unexpectedRuntime, checks};
}

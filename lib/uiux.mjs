/** UI·UX 실행 계약과 증거 묶음. UI 품질을 임의의 점수로 환산하지 않는다. */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';

export const SCHEMA_VERSION = 1;
const STATUSES = new Set(['pass', 'fail', 'incomplete']);
const ACTIONS = new Set(['goto', 'fill', 'click', 'press', 'assert-text', 'assert-visible', 'assert-hidden', 'reload']);
const ASSERTIONS = new Set(['assert-text', 'assert-visible', 'assert-hidden']);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function text(value, name, max = 2000) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${name}: 비어 있지 않은 ${max}자 이하 문자열이 필요합니다`);
  return value;
}
function keys(value, allowed, name) {
  requireThat(object(value), `${name}: 객체가 필요합니다`);
  const unknown = Object.keys(value).filter(k => !allowed.includes(k));
  requireThat(!unknown.length, `${name}: 알 수 없는 필드 ${unknown.join(', ')}`);
}
function integer(value, min, max, name) {
  requireThat(Number.isInteger(value) && value >= min && value <= max, `${name}: ${min}~${max} 정수가 필요합니다`);
}
function array(value, min, max, name) {
  requireThat(Array.isArray(value) && value.length >= min && value.length <= max, `${name}: ${min}~${max}개 배열이 필요합니다`);
}
function uniqueIds(values, name) {
  const seen = new Set();
  for (const value of values) {
    requireThat(object(value) && typeof value.id === 'string' && ID.test(value.id), `${name}: 안전한 id가 필요합니다`);
    requireThat(!seen.has(value.id), `${name}: 중복 id ${value.id}`);
    seen.add(value.id);
  }
  return seen;
}

export function validateContract(contract) {
  keys(contract, ['schema_version', 'project', 'goals', 'viewports', 'flows', 'states', 'tokens'], 'contract');
  requireThat(contract.schema_version === SCHEMA_VERSION, 'schema_version: 1만 지원합니다');
  keys(contract.project, ['name', 'platform', 'audience', 'locale'], 'project');
  text(contract.project.name, 'project.name', 160);
  text(contract.project.audience, 'project.audience', 1000);
  requireThat(['web', 'electron', 'qt'].includes(contract.project.platform), 'project.platform: web, electron, qt 중 하나가 필요합니다');
  if (contract.project.locale !== undefined) text(contract.project.locale, 'project.locale', 40);
  array(contract.goals, 1, 20, 'goals');
  contract.goals.forEach((goal, i) => text(goal, `goals[${i}]`));
  array(contract.viewports, 1, 8, 'viewports');
  const viewNames = new Set();
  for (const viewport of contract.viewports) {
    keys(viewport, ['name', 'width', 'height', 'device_scale_factor'], 'viewport');
    requireThat(typeof viewport.name === 'string' && ID.test(viewport.name), 'viewport.name: 안전한 이름이 필요합니다');
    requireThat(!viewNames.has(viewport.name), '중복 viewport.name');
    viewNames.add(viewport.name);
    integer(viewport.width, 240, 4096, 'viewport.width');
    integer(viewport.height, 240, 4096, 'viewport.height');
    const scale = viewport.device_scale_factor ?? 1;
    requireThat(Number.isFinite(scale) && scale >= 1 && scale <= 3, 'device_scale_factor: 1~3 유한수가 필요합니다');
    requireThat(viewport.width * viewport.height * scale ** 2 <= 20000000, 'viewport: 실제 픽셀 수가 20,000,000을 초과합니다');
  }
  array(contract.flows, 1, 30, 'flows');
  const flowIds = uniqueIds(contract.flows, 'flows');
  for (const flow of contract.flows) {
    keys(flow, ['id', 'title', 'steps', 'expected_http', 'expected_console_errors', 'dialogs'], 'flow');
    text(flow.title, 'flow.title', 300);
    if (flow.expected_http !== undefined) {
      array(flow.expected_http, 0, 30, 'expected_http');
      const expected = new Set();
      for (const response of flow.expected_http) {
        keys(response, ['method', 'path', 'status', 'count'], 'expected_http');
        requireThat(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(response.method), 'expected_http.method가 잘못되었습니다');
        text(response.path, 'expected_http.path');
        requireThat(response.path.startsWith('/') && !response.path.startsWith('//') && !/[\\?#\x00-\x1f\x7f]/.test(response.path), 'expected_http.path는 query 없는 같은 origin 경로여야 합니다');
        integer(response.status, 400, 599, 'expected_http.status');
        integer(response.count ?? 1, 1, 20, 'expected_http.count');
        const identity = JSON.stringify([response.method, response.path, response.status]);
        requireThat(!expected.has(identity), '중복 expected_http'); expected.add(identity);
      }
    }
    if (flow.expected_console_errors !== undefined) {
      array(flow.expected_console_errors, 0, 30, 'expected_console_errors');
      const expected = new Set();
      for (const entry of flow.expected_console_errors) {
        keys(entry, ['message', 'count'], 'expected_console_errors');
        text(entry.message, 'expected_console_errors.message', 4000);
        integer(entry.count ?? 1, 1, 20, 'expected_console_errors.count');
        requireThat(!expected.has(entry.message), '중복 expected_console_errors'); expected.add(entry.message);
      }
    }
    if (flow.dialogs !== undefined) {
      array(flow.dialogs, 0, 30, 'dialogs');
      for (const dialog of flow.dialogs) {
        keys(dialog, ['type', 'message', 'action', 'prompt_text'], 'dialog');
        requireThat(['alert', 'confirm', 'prompt'].includes(dialog.type) && ['accept', 'dismiss'].includes(dialog.action), 'dialog 종류/동작이 잘못되었습니다');
        text(dialog.message, 'dialog.message', 1000);
        if (dialog.prompt_text !== undefined) requireThat(dialog.type === 'prompt' && dialog.action === 'accept' && typeof dialog.prompt_text === 'string' && dialog.prompt_text.length <= 4000, 'prompt_text는 prompt accept의 4000자 이하 입력이어야 합니다');
      }
    }
    array(flow.steps, 2, 60, 'flow.steps');
    requireThat(flow.steps[0]?.action === 'goto', `${flow.id}: 첫 단계는 goto여야 합니다`);
    requireThat(flow.steps.some(step => ASSERTIONS.has(step?.action)), `${flow.id}: 명시적 assert 단계가 필요합니다`);
    for (const [index, step] of flow.steps.entries()) {
      keys(step, ['action', 'path', 'target', 'value', 'key', 'text'], `${flow.id}.steps[${index}]`);
      requireThat(ACTIONS.has(step.action), '지원하지 않는 action');
      const expected = { goto: ['path'], fill: ['target', 'value'], click: ['target'], press: ['target', 'key'],
        'assert-text': ['target', 'text'], 'assert-visible': ['target'], 'assert-hidden': ['target'], reload: [] }[step.action];
      for (const key of expected) requireThat(Object.hasOwn(step, key), `${step.action}: ${key}가 필요합니다`);
      for (const key of Object.keys(step).filter(k => k !== 'action')) requireThat(expected.includes(key), `${step.action}: 불필요한 ${key} 필드`);
      if (step.action === 'goto') {
        text(step.path, 'goto.path');
        requireThat(step.path.startsWith('/') && !step.path.startsWith('//') && !step.path.includes('\\') && !/[\x00-\x1f\x7f]/.test(step.path), 'goto.path: 같은 origin의 /경로만 허용합니다');
      }
      if (step.target !== undefined) {
        keys(step.target, ['role', 'name', 'test_id', 'selector'], 'target');
        const forms = [Object.hasOwn(step.target, 'role'), Object.hasOwn(step.target, 'test_id'), Object.hasOwn(step.target, 'selector')];
        requireThat(forms.filter(Boolean).length === 1, 'target: role/name, test_id, selector 중 한 형식만 허용합니다');
        if (step.target.role !== undefined) {
          text(step.target.role, 'target.role', 80);
          text(step.target.name, 'target.name', 300);
        } else requireThat(!Object.hasOwn(step.target, 'name'), 'target.name은 role과 함께 써야 합니다');
        if (step.target.test_id !== undefined) text(step.target.test_id, 'target.test_id', 300);
        if (step.target.selector !== undefined) text(step.target.selector, 'target.selector', 500);
      }
      if (step.value !== undefined) requireThat(typeof step.value === 'string' && step.value.length <= 4000, 'fill.value: 4000자 이하 문자열이 필요합니다');
      if (step.text !== undefined) text(step.text, 'assert-text.text');
      if (step.key !== undefined) text(step.key, 'press.key', 100);
    }
  }
  array(contract.states, 1, 100, 'states');
  uniqueIds(contract.states, 'states');
  for (const state of contract.states) {
    keys(state, ['id', 'title', 'flow_id'], 'state');
    text(state.title, 'state.title', 300);
    requireThat(flowIds.has(state.flow_id), `${state.id}: 존재하는 flow_id가 필요합니다`);
  }
  if (contract.tokens !== undefined) {
    keys(contract.tokens, ['colors', 'spacing', 'radii', 'font_family', 'font_sizes'], 'tokens');
    if (contract.tokens.colors !== undefined) {
      requireThat(object(contract.tokens.colors) && Object.keys(contract.tokens.colors).length <= 40, 'tokens.colors: 40개 이하 색상 객체가 필요합니다');
      for (const [name, color] of Object.entries(contract.tokens.colors))
        requireThat(ID.test(name) && typeof color === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color), 'tokens.colors: 이름과 #RGB/#RRGGBB/#RRGGBBAA 값이 필요합니다');
    }
    for (const name of ['spacing', 'radii', 'font_sizes']) if (contract.tokens[name] !== undefined) {
      array(contract.tokens[name], 1, 40, `tokens.${name}`);
      requireThat(contract.tokens[name].every((n, i, a) => Number.isFinite(n) && n >= 0 && n <= 512 && (i === 0 || n > a[i - 1])), `tokens.${name}: 0~512 오름차순 수가 필요합니다`);
    }
    if (contract.tokens.font_family !== undefined) text(contract.tokens.font_family, 'tokens.font_family', 300);
  }
  return contract;
}

export function templateContract({name = '새 UI 프로젝트', platform = 'web'} = {}) {
  const contract = { schema_version: 1,
    project: { name, platform, audience: '실제 사용자의 역할과 사용 환경으로 교체', locale: 'ko-KR' },
    goals: ['사용자가 완료해야 할 핵심 작업과 성공 조건으로 교체'],
    tokens: { colors: { background: '#ffffff', text: '#17212b', accent: '#175cd3' }, spacing: [4, 8, 12, 16, 24, 32], radii: [0, 4, 8], font_sizes: [14, 16, 20, 28] },
    viewports: [{ name: 'desktop', width: 1280, height: 800 }, { name: 'compact', width: 390, height: 844 }],
    flows: [{ id: 'main', title: '실제 핵심 동작으로 교체', steps: [
      { action: 'goto', path: '/' }, { action: 'assert-visible', target: { role: 'heading', name: '실제 화면 제목으로 교체' } } ] }],
    states: [{ id: 'initial', title: '초기 화면', flow_id: 'main' }] };
  return validateContract(contract);
}

export function aggregateStatus(checks) {
  requireThat(Array.isArray(checks) && checks.length > 0, '빈 검사는 통과할 수 없습니다');
  for (const check of checks) {
    requireThat(object(check) && typeof check.id === 'string' && check.id.length > 0 && STATUSES.has(check.status), '잘못된 검사 결과');
    text(check.message, 'check.message', 100000);
  }
  return checks.some(c => c.status === 'fail') ? 'fail' : checks.some(c => c.status === 'incomplete') ? 'incomplete' : 'pass';
}

export async function readJson(path) {
  const stat = await lstat(path);
  requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 8 * 1024 * 1024, 'JSON은 8 MiB 이하 일반 파일이어야 합니다');
  return JSON.parse(await readFile(path, 'utf8'));
}

export function safeRelative(path) {
  requireThat(typeof path === 'string' && path.length > 0 && path.length < 500 && !path.includes('\\') && !path.includes('\0') && !isAbsolute(path) && !path.split('/').some(p => !p || p === '.' || p === '..') && !path.includes(':'), '안전하지 않은 증거 경로');
  return path;
}

async function fileEvidence(root, path) {
  safeRelative(path);
  const rootReal = await realpath(root);
  let cursor = rootReal;
  for (const segment of path.split('/')) {
    cursor = join(cursor, segment);
    const stat = await lstat(cursor);
    requireThat(!stat.isSymbolicLink(), '증거 경로의 symlink는 허용하지 않습니다');
  }
  const resolved = await realpath(cursor);
  requireThat(resolved.startsWith(rootReal + sep) && (await lstat(resolved)).isFile(), '증거 경로는 묶음 내부 일반 파일이어야 합니다');
  const file = await open(resolved, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = await file.stat();
    requireThat(stat.size <= 64 * 1024 * 1024, '증거 파일이 64 MiB를 초과합니다');
    const contents = await file.readFile();
    return { path, bytes: contents.length, sha256: sha256(contents) };
  } finally { await file.close(); }
}

export async function reserveOutput(directory) {
  const parent = resolve(dirname(directory));
  await mkdir(parent, {recursive: true});
  // 재실행이 실패 원본을 덮어쓰지 않도록 새 디렉토리만 허용한다.
  await mkdir(resolve(directory), {mode: 0o700});
  return resolve(directory);
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export function renderReport(result, manifest) {
  const counts = Object.fromEntries([...STATUSES].map(s => [s, result.checks.filter(c => c.status === s).length]));
  const rows = result.checks.map(c => `<tr data-status="${escapeHtml(c.status)}"><td>${escapeHtml(c.id)}</td><td>${escapeHtml(c.status)}</td><td>${escapeHtml(c.message)}</td></tr>`).join('');
  const artifacts = manifest.files.map(f => `<li><a href="${escapeHtml(f.path.split('/').map(encodeURIComponent).join('/'))}">${escapeHtml(f.path)}</a> · ${f.bytes} bytes · <code>${f.sha256}</code></li>`).join('');
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'"><title>UI·UX 실행 검수</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#162435;background:#f7f9fc;margin:auto;padding:24px;max-width:1100px}h1{line-height:1.2}table{border-collapse:collapse;width:100%;background:white}th,td{padding:12px;text-align:left;border:1px solid #bac5d3;vertical-align:top;overflow-wrap:anywhere}code{overflow-wrap:anywhere}a{color:#174ca6}caption{text-align:left;padding:8px 0}main{overflow-x:auto}</style><main><h1>UI·UX 실행 검수: ${escapeHtml(result.status)}</h1><p>종류 ${escapeHtml(result.kind)} · 통과 ${counts.pass} · 실패 ${counts.fail} · 미확인 ${counts.incomplete}</p><p>검사한 조건에 대한 결과입니다. 미적 품질, 원제품 동등성, 실제 OS 전체 검증을 의미하지 않습니다.</p><h2>실행 환경</h2><pre>${escapeHtml(JSON.stringify(result.environment, null, 2))}</pre><h2>검사</h2><table><caption>실행 검사별 판정과 관찰</caption><thead><tr><th scope="col">검사</th><th scope="col">판정</th><th scope="col">관찰</th></tr></thead><tbody>${rows}</tbody></table><h2>한계</h2><ul>${(result.limitations ?? []).map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul><h2>증거 파일</h2><ul>${artifacts}</ul><p>해시는 파일 변경을 탐지합니다. 작성자의 신원이나 판정의 진실성을 인증하지 않습니다.</p></main></html>`;
}

export async function writeBundle(directory, rawResult, {contract, pluginVersion = '0.4.0'} = {}) {
  requireThat(rawResult.schema_version === 1 && ['web', 'qt'].includes(rawResult.kind) && object(rawResult.environment), '결과 envelope이 잘못되었습니다');
  const computed = aggregateStatus(rawResult.checks);
  requireThat(rawResult.status === computed, '결과 status와 실제 checks 판정이 일치하지 않습니다');
  requireThat(Array.isArray(rawResult.artifacts), 'artifacts 배열이 필요합니다');
  const result = {...rawResult, limitations: rawResult.limitations ?? []};
  requireThat(Array.isArray(result.limitations) && result.limitations.every(l => typeof l === 'string'), 'limitations 형식 오류');
  const paths = new Set();
  const files = [];
  for (const artifact of result.artifacts) {
    requireThat(object(artifact) && !['result.json', 'contract.json', 'manifest.json', 'report.html'].includes(artifact.path), '예약된 artifact 경로');
    requireThat(!paths.has(artifact.path), '중복 artifact 경로');
    paths.add(artifact.path);
    const file = await fileEvidence(directory, artifact.path);
    requireThat(file.sha256 === artifact.sha256, `artifact 해시 불일치: ${artifact.path}`);
    files.push(file);
  }
  if (contract) {
    validateContract(contract);
    await writeFile(join(directory, 'contract.json'), JSON.stringify(contract, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    files.push(await fileEvidence(directory, 'contract.json'));
  }
  await writeFile(join(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  files.push(await fileEvidence(directory, 'result.json'));
  const manifest = {schema_version: 1, plugin: {name: 'replica-suite', version: pluginVersion}, created_at: new Date().toISOString(),
    status: computed, kind: result.kind, files };
  await writeFile(join(directory, 'report.html'), renderReport(result, manifest), {flag: 'wx', mode: 0o600});
  files.push(await fileEvidence(directory, 'report.html'));
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  return manifest;
}

async function listFiles(root, prefix = '') {
  const paths = [];
  for (const entry of await readdir(join(root, prefix), {withFileTypes: true})) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    requireThat(!entry.isSymbolicLink(), '묶음에는 symlink를 넣을 수 없습니다');
    if (entry.isDirectory()) paths.push(...await listFiles(root, path));
    else { requireThat(entry.isFile(), '묶음에 일반 파일이 아닌 항목이 있습니다'); paths.push(path); }
    requireThat(paths.length <= 20000, '묶음 파일 개수 제한 초과');
  }
  return paths;
}

export async function verifyBundle(directory) {
  requireThat(!(await lstat(directory)).isSymbolicLink(), '묶음 root symlink는 허용하지 않습니다');
  const manifest = await readJson(join(directory, 'manifest.json'));
  requireThat(manifest.schema_version === 1 && STATUSES.has(manifest.status), 'manifest 형식 오류');
  array(manifest.files, 2, 20000, 'manifest.files');
  const seen = new Set();
  for (const expected of manifest.files) {
    requireThat(object(expected) && !seen.has(expected.path) && expected.path !== 'manifest.json', '중복/재귀 manifest 경로');
    requireThat(/^[0-9a-f]{64}$/.test(expected.sha256) && Number.isSafeInteger(expected.bytes), '잘못된 파일 해시/크기');
    const actual = await fileEvidence(directory, expected.path);
    requireThat(actual.sha256 === expected.sha256 && actual.bytes === expected.bytes, `증거 변조/손상: ${expected.path}`);
    seen.add(expected.path);
  }
  requireThat(seen.has('result.json') && seen.has('report.html'), '필수 결과/보고서 누락');
  const allFiles = await listFiles(directory);
  requireThat(allFiles.length === seen.size + 1 && allFiles.every(p => p === 'manifest.json' || seen.has(p)), 'manifest에 없는 파일이 있습니다');
  const result = await readJson(join(directory, 'result.json'));
  requireThat(result.status === aggregateStatus(result.checks) && result.status === manifest.status, 'manifest/result/checks 판정 불일치');
  requireThat(result.kind === manifest.kind, 'manifest/result kind 불일치');
  for (const artifact of result.artifacts ?? []) {
    const entry = manifest.files.find(f => f.path === artifact.path);
    requireThat(entry && entry.sha256 === artifact.sha256, '결과 artifact와 manifest 불일치');
  }
  if (seen.has('contract.json')) validateContract(await readJson(join(directory, 'contract.json')));
  return {schema_version: 1, integrity: 'pass', audit_status: result.status, files: seen.size,
    limitation: '무결성만 검사합니다. 작성자의 신원·검사 결론의 진실성은 인증하지 않습니다.'};
}

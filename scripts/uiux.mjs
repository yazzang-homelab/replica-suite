#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, reserveOutput, templateContract, validateContract, verifyBundle, writeBundle } from '../lib/uiux.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const help = `replica-suite UI·UX 작업대
사용: node scripts/uiux.mjs <명령> [옵션]
  init --out 계약.json [--name 이름] [--platform web|electron|qt]
  validate --contract 계약.json
  audit --contract 계약.json --base-url http://127.0.0.1:포트 --out 새디렉토리
        [--browser-executable 절대경로] [--allow-origin https://허용원점] [--timeout-ms 15000]
  qt --snapshot 위젯.json --out 새디렉토리 [--python python3]
  verify --bundle 검수디렉토리
종료값: 0=통과, 1=검사/무결성 실패, 2=입력/도구 오류, 3=미확인.
검수는 지정한 앱을 실제로 조작합니다. snapshot만으로 앱 실행을 인증하지 않습니다.
`;

function parse(argv) {
  const [command, ...args] = argv;
  const allowed = {init: ['out', 'name', 'platform'], validate: ['contract'],
    audit: ['contract', 'base-url', 'out', 'browser-executable', 'allow-origin', 'timeout-ms'],
    qt: ['snapshot', 'out', 'python'], verify: ['bundle']}[command];
  if (!allowed) throw new Error('지원하지 않는 명령. --help를 확인하세요');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !allowed.includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`잘못된 옵션: ${args[i]}`);
    if (key === 'allow-origin') (options[key] ??= []).push(args[i + 1]);
    else { if (Object.hasOwn(options, key)) throw new Error(`중복 옵션: ${key}`); options[key] = args[i + 1]; }
  }
  const required = {init: ['out'], validate: ['contract'], audit: ['contract', 'base-url', 'out'], qt: ['snapshot', 'out'], verify: ['bundle']}[command];
  for (const key of required) if (!options[key]) throw new Error(`필수 옵션: --${key}`);
  return {command, options};
}

async function qtSnapshot(python, snapshot, destination) {
  const child = spawn(python, [join(root, 'lib/uiux_qt.py'), '--snapshot', resolve(snapshot), '--out', destination], {stdio: ['ignore', 'ignore', 'pipe']});
  let stderr = '';
  child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-4000); });
  const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
  try {
    const code = await new Promise((res, rej) => { child.on('error', rej); child.on('close', res); });
    if (![0, 1, 3].includes(code)) throw new Error(`Qt 도구 오류 (${code}): ${stderr}`);
    return await readJson(destination);
  } finally { clearTimeout(timer); }
}

async function main() {
  if (process.argv.length === 2 || process.argv.slice(2).includes('--help')) { process.stdout.write(help); return 0; }
  const {command, options: o} = parse(process.argv.slice(2));
  if (command === 'init') {
    const contract = templateContract({name: o.name, platform: o.platform});
    await writeFile(resolve(o.out), JSON.stringify(contract, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    console.log(JSON.stringify({status: 'created', path: resolve(o.out), note: '초안입니다. 실제 사용자·작업·상태·단계로 교체하세요.'}));
    return 0;
  }
  if (command === 'validate') {
    const contract = validateContract(await readJson(resolve(o.contract)));
    console.log(JSON.stringify({status: 'pass', scope: 'contract-structure', flows: contract.flows.length, viewports: contract.viewports.length}));
    return 0;
  }
  if (command === 'verify') {
    const stat = await lstat(resolve(o.bundle));
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('--bundle은 실제 디렉토리여야 합니다');
    try { console.log(JSON.stringify(await verifyBundle(resolve(o.bundle)))); return 0; }
    catch (error) {
      if (['EACCES', 'EPERM'].includes(error.code)) throw error;
      console.log(JSON.stringify({integrity: 'fail', error: error.message})); return 1;
    }
  }
  let result, contract;
  if (command === 'audit') {
    contract = validateContract(await readJson(resolve(o.contract)));
    if (contract.project.platform === 'qt') throw new Error('Qt는 qt 명령 또는 audit_widgets API로 검사하세요');
    const timeoutMs = Number(o['timeout-ms'] ?? 15000);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new Error('--timeout-ms는 100~120000 정수여야 합니다');
    const base = new URL(o['base-url']);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('base-url은 자격증명 없는 HTTP(S) URL이어야 합니다');
    const {runWebAudit, validateInput} = await import('../lib/uiux-web.mjs');
    validateInput(contract, base.href, timeoutMs, o['allow-origin'] ?? []);
    const directory = await reserveOutput(resolve(o.out));
    result = await runWebAudit({contract, baseUrl: base.href, outDir: directory, executablePath: o['browser-executable'], timeoutMs, allowOrigins: o['allow-origin'] ?? []});
    const {version} = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    await writeBundle(directory, result, {contract, pluginVersion: version});
  } else {
    // 스냅샷은 코드로 import하지 않고 JSON 데이터로만 읽는다.
    await readJson(resolve(o.snapshot));
    const staging = await mkdtemp(join(tmpdir(), 'replica-qt-snapshot-'));
    try {
      const temporaryResult = join(staging, 'qt-snapshot-result.json');
      result = await qtSnapshot(o.python ?? 'python3', o.snapshot, temporaryResult);
      const raw = await readFile(temporaryResult);
      const directory = await reserveOutput(resolve(o.out));
      await writeFile(join(directory, 'qt-snapshot-result.json'), raw, {flag: 'wx', mode: 0o600});
      const {createHash} = await import('node:crypto');
      result.artifacts = [...(result.artifacts ?? []), {path: 'qt-snapshot-result.json', sha256: createHash('sha256').update(raw).digest('hex')}];
      await writeBundle(directory, result);
    } finally { await rm(staging, {recursive: true, force: true}); }
  }
  console.log(JSON.stringify({status: result.status, kind: result.kind, checks: result.checks.length, report: join(resolve(o.out), 'report.html')}));
  return {pass: 0, fail: 1, incomplete: 3}[result.status];
}
main().then(code => {process.exitCode = code;}).catch(error => { console.error(JSON.stringify({status: 'error', error: error.message})); process.exitCode = 2; });

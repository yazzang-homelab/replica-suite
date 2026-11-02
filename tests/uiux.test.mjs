import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp, readFile, rm, symlink, writeFile, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {assessExpectedEvents} from '../lib/uiux-expectations.mjs';
import {aggregateStatus, readJson, renderReport, reserveOutput, safeRelative, sha256, templateContract, validateContract, verifyBundle, writeBundle} from '../lib/uiux.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../scripts/uiux.mjs', import.meta.url));
const result = status => ({schema_version: 1, kind: 'web', status, environment: {platform: 'synthetic-unit'}, checks: [{id: 'assertion', status, message: '단위검사 fixture'}], artifacts: [], limitations: []});
async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), 'replica-uiux-unit-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}
function changed(change) { const c = templateContract(); change(c); return c; }

test('계약 초안은 두 viewport와 실제 assertion 작성 위치를 제공한다', () => {
  const c = templateContract({name: '메모 편집기', platform: 'electron'});
  assert.equal(c.project.platform, 'electron');
  assert.equal(c.viewports.length, 2);
  assert.equal(validateContract(c), c);
});
test('빈 검사·assertion 누락·첫 goto 누락은 거부한다', () => {
  assert.throws(() => aggregateStatus([]));
  for (const change of [c => c.flows = [], c => c.flows[0].steps = [{action: 'goto', path: '/'}, {action: 'reload'}], c => c.flows[0].steps.reverse()])
    assert.throws(() => validateContract(changed(change)));
});
test('오타 필드·중복 식별자·없는 상태 흐름을 거부한다', () => {
  for (const change of [c => c.foo = 1, c => c.flows.push(structuredClone(c.flows[0])), c => c.viewports.push({...c.viewports[0]}), c => c.states[0].flow_id = 'absent', c => c.states.push({...c.states[0]})])
    assert.throws(() => validateContract(changed(change)));
});
test('원격 goto·프로토콜 경로·백슬래시·제어문자를 거부한다', () => {
  for (const path of ['https://example.test/', '//example.test/', '/\\example.test/', '/bad\npath'])
    assert.throws(() => validateContract(changed(c => c.flows[0].steps[0].path = path)));
});
test('selector 형식 충돌과 의미 없는 assert 문자열을 거부한다', () => {
  for (const target of [{role: 'button'}, {name: 'x'}, {role: 'button', name: 'x', selector: '#x'}, {test_id: 'x', name: 'x'}, {selector: ''}])
    assert.throws(() => validateContract(changed(c => c.flows[0].steps[1].target = target)));
  assert.throws(() => validateContract(changed(c => c.flows[0].steps[1] = {action: 'assert-text', target: {test_id: 'x'}, text: ' '})));
});
test('알 수 없는 action·행위와 무관한 필드·과도한 픽셀을 거부한다', () => {
  for (const change of [c => c.flows[0].steps[1].action = 'eval', c => c.flows[0].steps[0].value = 'x', c => c.viewports[0].device_scale_factor = NaN, c => c.viewports[0] = {name:'huge',width:4096,height:4096,device_scale_factor:3}])
    assert.throws(() => validateContract(changed(change)));
});
test('디자인 토큰은 유한한 증가 수열과 색상값만 받는다', () => {
  for (const tokens of [{spacing: [8,4]}, {colors: {accent: 'url(evil)'}}, {radii: [Infinity]}, {font_sizes: [12,12]}, {spacing: []}])
    assert.throws(() => validateContract(changed(c => c.tokens = tokens)));
});
test('실패와 미확인 결과를 통과로 집계하지 않는다', () => {
  const checks = [result('pass').checks[0], result('incomplete').checks[0]];
  assert.equal(aggregateStatus(checks), 'incomplete');
  checks.push(result('fail').checks[0]);
  assert.equal(aggregateStatus(checks), 'fail');
  assert.throws(() => aggregateStatus([{id:'x',status:'skipped',message:'x'}]));
});
test('증거 경로 이탈과 플랫폼별 절대 경로를 거부한다', () => {
  for (const path of ['../outside', '/tmp/x', 'C:\\x', 'web/../x', './x', 'web//x', 'x\0y', 'https:x'])
    assert.throws(() => safeRelative(path));
  assert.equal(safeRelative('web/0-0.png'), 'web/0-0.png');
});
test('기존 출력 디렉토리를 재사용하지 않는다', async t => {
  const root = await temporary(t);
  const output = join(root, 'new');
  await reserveOutput(output);
  await writeFile(join(output, 'failure.json'), 'original');
  await assert.rejects(reserveOutput(output));
  assert.equal(await readFile(join(output, 'failure.json'), 'utf8'), 'original');
});
test('증거 묶음은 artifact·계약·보고서 해시를 재검증한다', async t => {
  const root = await temporary(t);
  await mkdir(join(root, 'web'));
  await writeFile(join(root, 'web/0.txt'), 'actual observation');
  const r = result('incomplete');
  r.artifacts.push({path:'web/0.txt',sha256:sha256('actual observation')});
  const m = await writeBundle(root, r, {contract:templateContract()});
  assert.equal(m.files.length, 4);
  const verification = await verifyBundle(root);
  assert.equal(verification.integrity, 'pass');
  assert.equal(verification.audit_status, 'incomplete');
});
test('증거 수정과 manifest에 없는 파일을 발견한다', async t => {
  const root = await temporary(t);
  await writeBundle(root, result('pass'));
  await writeFile(join(root, 'extra.txt'), 'extra');
  await assert.rejects(verifyBundle(root), /manifest/);
  await rm(join(root, 'extra.txt'));
  await writeFile(join(root, 'result.json'), JSON.stringify(result('fail')));
  await assert.rejects(verifyBundle(root), /변조|손상/);
});
test('빈 checks와 summary 판정 불일치는 보고서 생성 전 차단한다', async t => {
  const root = await temporary(t);
  const r = result('pass'); r.checks[0].status = 'fail';
  await assert.rejects(writeBundle(root, r), /일치/);
  r.checks = [];
  await assert.rejects(writeBundle(root, r), /빈 검사/);
});
test('manifest duplicate·판정 거짓 변경·누락된 보고서를 거부한다', async t => {
  const root = await temporary(t);
  const m = await writeBundle(root, result('incomplete'));
  await writeFile(join(root, 'manifest.json'), JSON.stringify({...m, status:'pass'}));
  await assert.rejects(verifyBundle(root), /판정/);
  await writeFile(join(root, 'manifest.json'), JSON.stringify({...m, files:[...m.files,m.files[0]]}));
  await assert.rejects(verifyBundle(root), /중복/);
  await writeFile(join(root, 'manifest.json'), JSON.stringify({...m,files:m.files.filter(f=>f.path!=='report.html')}));
  await assert.rejects(verifyBundle(root));
});
test('증거 파일과 중간 디렉토리 symlink를 읽지 않는다', async t => {
  const root = await temporary(t);
  const outside = join(root,'outside'); await mkdir(outside); await writeFile(join(outside,'x.txt'),'secret fixture');
  for (const directory of ['file-link','directory-link']) {
    const output = join(root,directory); await mkdir(output);
    const path = directory === 'file-link' ? 'x.txt' : 'web/x.txt';
    if (directory==='file-link') await symlink(join(outside,'x.txt'),join(output,path));
    else await symlink(outside, join(output,'web'));
    const r = result('pass'); r.artifacts.push({path,sha256:sha256('secret fixture')});
    await assert.rejects(writeBundle(output,r),/symlink/);
  }
});
test('보고서의 외부 텍스트는 HTML로 실행되지 않는다', () => {
  const r = result('fail');
  r.checks[0].message = '<img src=x onerror="alert(1)">';
  r.environment.backend = '</pre><script>alert(2)</script>';
  const html = renderReport(r,{files:[]});
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('Content-Security-Policy'));
});
test('CLI는 기존 계약을 덮어쓰지 않고 잘못된 옵션을 거부한다', async t => {
  const root = await temporary(t);
  const output = join(root,'contract.json');
  const created = await exec(process.execPath,[cli,'init','--out',output]);
  assert.equal(JSON.parse(created.stdout).status,'created');
  const before = await readFile(output,'utf8');
  await assert.rejects(exec(process.execPath,[cli,'init','--out',output]),e=>e.code===2);
  assert.equal(await readFile(output,'utf8'),before);
  await assert.rejects(exec(process.execPath,[cli,'validate','--contract',output,'--typo','x']),e=>e.code===2);
  const validated = await exec(process.execPath,[cli,'validate','--contract',output]);
  assert.equal(JSON.parse(validated.stdout).scope,'contract-structure');
});
test('readJson은 잘못된 JSON과 symlink를 거부한다', async t => {
  const root = await temporary(t);
  const file = join(root,'bad.json'); await writeFile(file,'NaN');
  await assert.rejects(readJson(file));
  await symlink(file,join(root,'link.json'));
  await assert.rejects(readJson(join(root,'link.json')),/일반 파일/);
});
test('verify의 잘못된 입력 경로와 묶음 내부 손상을 구분한다', async t => {
  const root = await temporary(t);
  await assert.rejects(exec(process.execPath,[cli,'verify','--bundle',join(root,'absent')]),e=>e.code===2);
  const file = join(root,'file'); await writeFile(file,'not a directory');
  await assert.rejects(exec(process.execPath,[cli,'verify','--bundle',file]),e=>e.code===2);
  const bundle=join(root,'bundle'); await mkdir(bundle); await writeBundle(bundle,result('pass'));
  await rm(join(bundle,'report.html'));
  await assert.rejects(exec(process.execPath,[cli,'verify','--bundle',bundle]),e=>e.code===1);
});
test('기대 오류와 dialog는 정확한 상태·메시지·횟수로 한정한다', () => {
  const valid=changed(c=>Object.assign(c.flows[0],{expected_http:[{method:'POST',path:'/validate',status:422}],expected_console_errors:[{message:'validation rejected',count:1}],dialogs:[{type:'confirm',message:'정말 삭제합니까?',action:'accept'}]}));
  assert.equal(validateContract(valid),valid);
  for(const entry of [{method:'*',path:'/x',status:422},{method:'POST',path:'//other',status:422},{method:'POST',path:'/x?token=y',status:422},{method:'POST',path:'/x',status:200},{method:'POST',path:'/x',status:422,count:0}])
    assert.throws(()=>validateContract(changed(c=>c.flows[0].expected_http=[entry])));
  assert.throws(()=>validateContract(changed(c=>c.flows[0].expected_console_errors=[{message:'x',count:0}])));
  assert.throws(()=>validateContract(changed(c=>c.flows[0].dialogs=[{type:'confirm',message:'x',action:'accept',prompt_text:'oops'}])));
});
test('기대 HTTP 오류는 정확한 origin·method·path·status·count만 소비한다', () => {
  const flow={expected_http:[{method:'POST',path:'/validate',status:422}]};
  const expected={method:'POST',url:'http://127.0.0.1:1234/validate',status:422};
  const actual=assessExpectedEvents({flow,baseUrl:'http://127.0.0.1:1234/',httpErrors:[expected,{...expected}, {...expected,url:'http://127.0.0.1:4321/validate'}, {...expected,method:'GET'}, {...expected,status:500}]});
  assert.equal(actual.unexpectedHttp.length,4);
  assert.equal(actual.checks[0].status,'pass');
  const absent=assessExpectedEvents({flow,baseUrl:'http://127.0.0.1:1234/'});
  assert.equal(absent.checks[0].status,'fail');
});
test('예상한 응답의 브라우저 자동 오류만 실제 응답 횟수와 연결한다', () => {
  const baseUrl='http://127.0.0.1:1234/';
  const flow={expected_http:[{method:'POST',path:'/validate',status:422}]};
  const automatic={type:'console.error',url:baseUrl+'validate',message:'Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)'};
  const result=assessExpectedEvents({flow,baseUrl,httpErrors:[{method:'POST',url:baseUrl+'validate',status:422}],runtimeErrors:[automatic,{...automatic},{...automatic,url:baseUrl+'app.js'},{type:'pageerror',message:'exception'}]});
  assert.equal(result.unexpectedRuntime.length,3);
  assert.equal(result.unexpectedHttp.length,0);
});
test('기대 console 오류의 누락·초과와 dialog 순서 불일치는 숨기지 않는다', () => {
  const flow={expected_console_errors:[{message:'expected'}],dialogs:[{type:'confirm',message:'삭제?',action:'accept'}]};
  const result=assessExpectedEvents({flow,baseUrl:'http://127.0.0.1/',runtimeErrors:[{type:'console.error',message:'expected'},{type:'console.error',message:'expected'}],dialogs:[{type:'confirm',message:'삭제?',action:'dismiss',settled:true}]});
  assert.equal(result.unexpectedRuntime.length,1);
  assert.equal(result.checks[0].status,'pass');
  assert.equal(result.checks[1].status,'fail');
});
test('보고서에서 절단한 console 로그를 정확히 일치한 기대값으로 오인하지 않는다', () => {
  const prefix='x'.repeat(4000);
  const result=assessExpectedEvents({flow:{expected_console_errors:[{message:prefix}]},baseUrl:'http://127.0.0.1/',runtimeErrors:[{type:'console.error',message:prefix,truncated:true,full_length:4001}]});
  assert.equal(result.unexpectedRuntime.length,1);
  assert.equal(result.checks[0].status,'fail');
});

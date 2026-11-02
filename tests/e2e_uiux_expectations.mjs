/** 기대한 실패 상태를 허용하면서 예상하지 않은 오류를 숨기지 않는 실제 브라우저 검수. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runWebAudit} from '../lib/uiux-web.mjs';
import {validateContract} from '../lib/uiux.mjs';

const temporary=await mkdtemp(join(tmpdir(),'replica-uiux-expected-'));
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>기대 상태 검수</title><style>body{font:18px system-ui;color:#17212b;background:white;padding:24px}button{font:inherit;min-height:44px;padding:10px 20px;margin:4px}</style><main><h1>오류와 확인 상태</h1><button id="validate">검증 제출</button><button id="mixed">혼합 오류</button><button id="log">검증 로그</button><button id="extra">반복 로그</button><button id="confirm">확인 요청</button><button id="prompt">이름 입력</button><button id="alert">알림 표시</button><p id="out" role="status">대기</p></main><script>
document.querySelector('#validate').onclick=async()=>{await fetch('/validate',{method:'POST'});document.querySelector('#out').textContent='형식 오류'};
document.querySelector('#mixed').onclick=async()=>{await fetch('/validate',{method:'POST'});await fetch('/unexpected',{method:'POST'});document.querySelector('#out').textContent='혼합 완료'};
document.querySelector('#log').onclick=()=>{console.error('의도한 검증 로그');document.querySelector('#out').textContent='로그 완료'};
window.logLong=(extra)=>{console.error('x'.repeat(4000)+(extra?'suffix':''));document.querySelector('#out').textContent='장문 완료'};
document.querySelector('#extra').onclick=()=>{console.error('의도한 검증 로그');console.error('의도한 검증 로그');document.querySelector('#out').textContent='로그 완료'};
document.querySelector('#confirm').onclick=()=>document.querySelector('#out').textContent=confirm('정말 삭제합니까?')?'승인':'취소';
document.querySelector('#prompt').onclick=()=>document.querySelector('#out').textContent=prompt('이름을 입력하세요')??'취소';
document.querySelector('#alert').onclick=()=>{alert('완료 알림');document.querySelector('#out').textContent='알림 완료'};
</script></html>`;
const server=createServer((req,res)=>{
  if(req.url==='/validate'){res.writeHead(422,{'content-type':'application/json'});res.end('{"error":"invalid"}');return;}
  if(req.url==='/unexpected'){res.writeHead(500,{'content-type':'text/plain'});res.end('unexpected');return;}
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const url=new URL(req.url,'http://localhost');
  const page=url.pathname==='/long'?html.replace('</main>','<button id="long" onclick="logLong('+String(url.searchParams.has('extra'))+')">장문 로그</button></main>'):html;
  res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(page);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const baseUrl=`http://127.0.0.1:${server.address().port}`;
const groups=[];
const target=name=>({role:'button',name});
const click=name=>({action:'click',target:target(name)});
const out=text=>({action:'assert-text',target:{selector:'#out'},text});
function contract(steps,settings={}){
  return validateContract({schema_version:1,project:{name:'기대 오류 검수',platform:'web',audience:'합성 QA'},goals:['예상한 상태와 예기치 않은 실패 구분'],viewports:[{name:'desktop',width:900,height:700}],flows:[{id:'flow',title:'상태 확인',steps:[{action:'goto',path:'/'},...steps],...settings}],states:[{id:'done',title:'결과',flow_id:'flow'}]});
}
async function audit(name,steps,settings){return runWebAudit({contract:contract(steps,settings),baseUrl,outDir:join(temporary,name),timeoutMs:10000});}
try{
  const expectedHttp={expected_http:[{method:'POST',path:'/validate',status:422}]};
  const accepted=await audit('expected422',[click('검증 제출'),out('형식 오류')],expectedHttp);
  assert.equal(accepted.status,'pass',JSON.stringify(accepted.checks.filter(c=>c.status!=='pass')));
  const unexpected=await audit('unexpected422',[click('검증 제출'),out('형식 오류')]);
  assert.equal(unexpected.status,'fail');
  const mixed=await audit('mixed',[click('혼합 오류'),out('혼합 완료')],expectedHttp);
  assert.equal(mixed.status,'fail');
  assert.ok(mixed.checks.some(c=>c.kind==='runtime'&&c.status==='fail'));
  groups.push('기대한422는통과,미선언422와추가500은실패');

  const logExpected={expected_console_errors:[{message:'의도한 검증 로그'}]};
  const log=await audit('expected-console',[click('검증 로그'),out('로그 완료')],logExpected);
  assert.equal(log.status,'pass');
  const repeated=await audit('extra-console',[click('반복 로그'),out('로그 완료')],logExpected);
  assert.equal(repeated.status,'fail');
  const absent=await audit('absent-console',[out('대기')],logExpected);
  assert.equal(absent.status,'fail');
  groups.push('기대console exact1회통과,추가·누락실패');

  for(const action of ['accept','dismiss']){
    const r=await audit(`confirm-${action}`,[click('확인 요청'),out(action==='accept'?'승인':'취소')],{dialogs:[{type:'confirm',message:'정말 삭제합니까?',action}]});
    assert.equal(r.status,'pass',JSON.stringify(r.checks.filter(c=>c.status!=='pass')));
  }
  const prompt=await audit('prompt',[click('이름 입력'),out('한글 사용자')],{dialogs:[{type:'prompt',message:'이름을 입력하세요',action:'accept',prompt_text:'한글 사용자'}]});
  assert.equal(prompt.status,'pass');
  const alert=await audit('alert',[click('알림 표시'),out('알림 완료')],{dialogs:[{type:'alert',message:'완료 알림',action:'accept'}]});
  assert.equal(alert.status,'pass');
  groups.push('confirmaccept·dismiss,prompt입력,alert실제처리');

  const wrong=await audit('wrong-dialog',[click('확인 요청'),out('취소')],{dialogs:[{type:'confirm',message:'다른 메시지',action:'accept'}]});
  assert.equal(wrong.status,'fail');
  const missing=await audit('missing-dialog',[out('대기')],{dialogs:[{type:'confirm',message:'정말 삭제합니까?',action:'accept'}]});
  assert.equal(missing.status,'fail');
  groups.push('dialog메시지불일치와미발생을실패로유지');
  // 앱 스크립트의 DOM 이벤트를 계약의 click으로만 실행한다. audit에 임의 JS를 넘기지 않는다.
  const longContract=contract([{action:'click',target:{selector:'#long'}},out('장문 완료')],{expected_console_errors:[{message:'x'.repeat(4000)}]});
  // 별도 라우트의 합성 HTML을 서버가 제공해 긴 콘솔 원문을 실제 브라우저에서 관측한다.
  longContract.flows[0].steps[0].path='/long?extra=1';
  const longer=await runWebAudit({contract:longContract,baseUrl,outDir:join(temporary,'longer'),timeoutMs:10000});
  assert.equal(longer.status,'fail');
  assert.ok(longer.checks.some(c=>c.kind==='runtime'&&c.evidence?.errors?.some(e=>e.truncated===true&&e.full_length>4000)));
  longContract.flows[0].steps[0].path='/long';
  const exact=await runWebAudit({contract:longContract,baseUrl,outDir:join(temporary,'long-exact'),timeoutMs:10000});
  assert.equal(exact.status,'pass');
  groups.push('4000자로그는정확일치만허용하고접두사가같은장문은실패');
  console.log(JSON.stringify({status:'PASS',suite:'uiux-expectations',verification_groups:groups.length,checks:groups},null,2));
}finally{
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  await rm(temporary,{recursive:true,force:true});
}

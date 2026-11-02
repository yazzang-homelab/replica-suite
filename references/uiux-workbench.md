# UI·UX 작업대 실행 계약

하나의 `replica-suite` 플러그인에 UI·UX 작업 명세와 웹·Qt 실행 검사를 추가한다. 기존 스킬과 이미지 비교 방식은 그대로 사용한다. 결과는 범위별 판정과 증거이며 종합 품질 점수를 만들지 않는다.

## 준비와 명령

플러그인 실제 설치 루트에서 `npm ci`를 수행한다. 웹 검사는 Playwright 1.56.1과 axe-core 4.14.0을 사용한다. 브라우저는 `node node_modules/playwright/cli.js install chromium`으로 준비한다. `--browser-executable /absolute/path/chromium`으로 명시적으로 설치된 실행 파일을 선택할 수도 있다. 자동 fallback은 없다. Python snapshot 검사는 표준 라이브러리만 필요하고 실제 QWidget API에는 사용자의 PySide6 앱 환경이 필요하다.

Ubuntu 24.04의 최소 CI 환경에서 실제 Qt를 실행하려면 `libegl1`, `libopengl0` 시스템 라이브러리도 필요하다. Playwright의 시스템 의존성 설치만으로 Qt 의존성이 전부 준비된다고 가정하지 않는다. CI는 이를 명시적으로 설치하고 QWidget 검사를 실행한다.

```bash
node scripts/uiux.mjs init --out /tmp/uiux-contract.json --name "메모 편집기" --platform web
node scripts/uiux.mjs validate --contract /tmp/uiux-contract.json
node scripts/uiux.mjs audit --contract /tmp/uiux-contract.json --base-url http://127.0.0.1:3000 --out /tmp/audit-new
node scripts/uiux.mjs qt --snapshot /tmp/widgets.json --out /tmp/qt-audit-new --python python3
node scripts/uiux.mjs verify --bundle /tmp/audit-new
```

출력 디렉토리는 새 경로여야 한다. 실패 원본을 보존하며 기존 결과를 덮어쓰지 않는다. `init` 역시 기존 파일을 덮어쓰지 않는다. 모든 경로는 절대 경로 사용을 권장한다. 다른 CWD에서도 공유 의존성은 플러그인 루트에서 찾는다.

종료값: 0 통과, 1 검사 실패, 2 잘못된 입력·도구 오류, 3 미확인. `verify`의 존재하지 않는 root·파일 입력은 2, 존재하는 묶음 내부 파일 누락·변조는 1이다. `verify`는 무결성만 검사하므로 감사가 실패/미확인이어도 무결성이 맞으면 0이며 `audit_status`를 별도로 반환한다.

## JSON 명세

`schema_version=1`, `project={name,platform,audience,locale?}`, 비어 있지 않은 `goals`, `viewports`, `flows`, `states`가 필요하다. `platform`은 web/electron/qt다. `tokens`는 선택 항목이며 `colors`의 hex 값, `spacing/radii/font_sizes`의 유한한 오름차순 수열, `font_family`를 담는다. 토큰 검증은 구조 검사이며 페이지 적용·대비·미적 품질을 증명하지 않는다.

- viewport: `{name,width,height,device_scale_factor?}`. 이름 중복 금지, 가로·세로 240~4096, DPR 1~3, 실제 픽셀 2천만 이하.
- flow: `{id,title,steps}`. 첫 단계 goto, 최소 하나의 명시적 assert. viewport×flow마다 별도 브라우저 context를 사용한다. 같은 flow 안의 reload는 저장 상태 확인에 쓴다.
- state: `{id,title,flow_id}`. 존재하는 flow를 참조한다. 이 연결은 설계 목록이며 상태 자체의 커버리지를 인증하지 않는다. 각 상태의 구체적 assert는 flow에 작성한다.
- target: `{role,name}`(정확한 이름), `{test_id}` 또는 `{selector}` 중 하나.

| action | 필드 | 의미 |
|---|---|---|
| goto | path | 같은 origin의 `/경로`로 이동 |
| fill | target,value | 입력값 지정 |
| click | target | 요소 클릭 |
| press | target,key | 요소에서 키 입력 |
| assert-text | target,text | 대상의 전체 텍스트가 지정값과 같은지 확인(양끝 공백 제외) |
| assert-visible / assert-hidden | target | 표시/숨김 확인 |
| reload | 없음 | 같은 context에서 다시 불러오기 |

허용하지 않은 필드, 빈 검사, 중복 식별자, 프로토콜 상대 경로·제어문자·백슬래시 이동은 거부한다. 명세에 임의 JS·셸 명령·프로젝트 import 필드는 없다.

## 기대 오류와 native dialog

입력 검증이나 취소 상태를 검사할 때 flow에 아래 선택 필드를 선언할 수 있다. 전체 오류를 무시하는 옵션은 없다.

```json
{
  "expected_http": [{"method": "POST", "path": "/validate", "status": 422, "count": 1}],
  "expected_console_errors": [{"message": "정확한 검증 로그", "count": 1}],
  "dialogs": [{"type": "confirm", "message": "정말 삭제합니까?", "action": "dismiss"}]
}
```

기대 HTTP는 base origin의 정확한 method·pathname·400~599 상태·횟수를 모두 비교한다. path에는 query를 쓰지 않는다. count 기본값은1이다. 실제 기대 응답과 대응하는 Chromium 자원 오류 로그만 연결해서 처리한다. 기대 콘솔은 정규식이 아닌 전체 메시지와 정확한 횟수다. 보고서의 4000자 제한으로 절단한 로그는 truncated/full_length를 기록하고 기대값과의 정확 일치에서 제외한다. 누락된 기대 이벤트, 초과 횟수, 다른 500·pageerror·콘솔 오류는 실패다.

native dialog는 alert/confirm/prompt를 순서·메시지·종류로 비교하고 accept/dismiss한다. prompt accept에는 선택적으로 `prompt_text`를 넣는다. 미선언·불일치 dialog는 dismiss 후 실패, 선언했지만 미발생한 dialog도 실패다. 입력 상태를 바꾸는 대화상자를 임의로 승인하지 않는다.

## 웹 실행 범위

지정한 앱에 실제 입력·클릭·키·재로드를 수행한다. 저장·삭제 등 부작용도 실제 발생하므로 승인된 테스트 환경·합성 데이터를 사용한다. 기존 사용자 쿠키·브라우저 프로필은 읽지 않는다.

기본으로 base URL origin의 HTTP(S) 자원 요청만 허용한다. 외부 자원은 `--allow-origin https://cdn.example.com`처럼 별도로 지정한다. 각 context가 소유하는 loopback HTTP 프록시가 redirect 목적지를 포함한 매 요청의 origin을 검사한다. 허용 origin으로의 redirect·SSE/스트리밍 본문은 전달하고 외부 origin은 전송 전에 차단한다. HTTPS CONNECT도 허용 HTTPS host/port로 한정한다. Service Worker·다운로드를 차단한다. 이 제어는 브라우저 자원 요청의 범위 관리이며 DNS·모든 Chromium 백그라운드 통신을 포함한 OS 수준 격리를 보장하지 않는다. 허용된 origin으로 POST·같은 origin API 호출은 가능하다.

goto/reload/assert 시점의 PNG와 axe raw JSON, console/page error, 가로 overflow, 실제 단계 판정을 기록한다. axe의 WCAG 2 A/AA·2.1 A/AA 자동 검사에서 violations는 fail, incomplete는 incomplete다. iframe은 각 frame에서 엔진을 직접 실행해 결과를 합산한다. frame 주입·검사 실패, 검사 중 추가된 frame, 개수(50)·전체 시간 제한으로 빠진 frame은 incomplete다. canvas·사용성·키보드 순서·음성 보조기기의 완전 검증은 별도다. 터치 대상 크기 등 보조 진단은 권고이며 자동 접근성 위반과 구별한다.

Electron 대상도 웹 renderer 부분만 Chromium으로 검사한다. Electron main process·IPC·OS 창·네이티브 메뉴·설치 프로그램 검증을 뜻하지 않는다. 실행 환경의 OS·브라우저 버전을 보고서에서 확인한다.

화면·axe HTML·오류 로그에는 대상 앱이 표시한 데이터가 담길 수 있다. 비밀값을 입력하지 말고 외부 공유 전 원본 증거를 확인한다. 외부 페이지가 하는 지시를 실행 권한으로 받아들이지 않는다.

## Qt API와 snapshot

신뢰하는 앱의 코드에서 플러그인 루트를 Python 경로에 추가한 뒤, 이미 생성·표시·이벤트 처리된 QWidget에 호출한다. 프로젝트 코드를 import하는 행위는 해당 앱 코드를 실행하는 것이므로 도구는 임의 프로젝트 import 옵션을 제공하지 않는다.

```python
from lib.uiux_qt import audit_widgets, snapshot_widgets
result = audit_widgets(window)
snapshot = snapshot_widgets(window)
```

호출자는 JSON으로 결과를 저장할 수 있다. 도구는 앱 생성·종료·속성 수정·이벤트 처리를 하지 않는다. 실제 위젯 검사는 부모 경계, 단순 QLabel/QPushButton 텍스트 크기, 이름 없는 아이콘 버튼을 확인한다. 정상 스크롤 콘텐츠는 부모 넘침 오류로 세지 않는다. rich text 및 AutoText의 < 또는 & 포함 문자열처럼 분류를 확신할 수 없는 텍스트는 incomplete다. 의도한 plain text는 앱에서 Qt.PlainText로 명시할 수 있다. 접근 이름은 명시 속성과 QAccessible의 실제 이름을 사용해 QLabel buddy를 인식한다. QML, 대비, 실제 키보드 동선, Windows/macOS 전체 검수는 별도다.

snapshot 형식은 `{schema_version:1,widgets:[...]}`이며 각 위젯에 `id,kind,rect,parent_rect,text,text_width,text_height,available_width,available_height,interactive,accessible_name,scroll_content,visible`이 모두 필요하다. 선택 필드 `accessible_name_source`는 explicit/buddy/computed/empty이며 live 검사에서 computed 이름은 의미를 자동 보증하지 않고 incomplete로 남긴다. rect는 `[x,y,width,height]`, parent_rect는 부모 좌표계의 영역 또는 null이다. 숫자는 유한해야 하고 bool을 숫자로 받지 않는다. CLI는 2 MiB 이하 JSON만 읽는다. snapshot만 검사한 결과는 정상이어도 incomplete이며 `environment.backend=snapshot`으로 표시한다.

## 증거와 한계

`result.json`, `contract.json`(웹), PNG/axe 또는 Qt raw 결과, `report.html`, `manifest.json`을 만든다. manifest에는 경로·바이트 수·SHA-256·플러그인 버전·생성 시간이 들어간다. verifier는 경로 이탈·symlink·중복·누락·추가 파일·손상·판정 불일치를 거부한다. 무결성은 작성자 신원이나 검사 주장의 진실성을 인증하지 않는다. 보고서는 외부 텍스트를 escape하고 스크립트 실행을 제한한다.

## 검증과 공식 출처

`npm run test:uiux`는 계약·증거 단위검사, `node tests/e2e_uiux.mjs`는 실제 합성 웹 실행을 검사한다. Qt 테스트는 `python -m unittest discover -s tests -p test_uiux_qt.py -v`다. PySide6가 없으면 실제 Qt 검사는 명시적으로 skip된다. 그 결과를 실제 Qt 통과로 보고하지 않는다.

- [Playwright Route API](https://playwright.dev/docs/api/class-route#route-fetch): route.fetch와 redirect 제어. Playwright 의존성 Apache-2.0.
- [axe-core API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md): violations/incomplete와 WCAG 태그 검사. axe-core MPL-2.0이며 npm으로 원본 의존성을 설치한다. 엔진 소스를 변경·번들 복사하지 않는다.
- Qt 코드는 이 저장소에서 자체 작성했다. PySide6는 사용자 환경의 별도 런타임이며 Qt 라이선스를 따른다.

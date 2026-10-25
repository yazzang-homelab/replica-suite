# replica-suite

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md)

버전 0.3.0. 앱과 웹사이트 이식·재구현을 위한 41개 공통 skills를 Codex, Claude Code, GJC에서 설치해 쓸 수 있습니다. 흐름은 증거, 명세, 구현, 검증 순서입니다.

저장소: https://github.com/yazzang-homelab/replica-suite. 플러그인 이름: `replica-suite`. 마켓플레이스 ID: `replica-suite-local`.

## 무엇인가

앱과 사이트를 이식하거나 다시 만들 때 에이전트가 따르는 skill 묶음입니다. 범위는 다음과 같습니다.

- 웹: 캡처나 스크린샷에서 HTML, React, Vue, Svelte, React Native, UnoCSS, QML 생성.
- 모바일 패키지: APK, IPA, Flutter, Unity.
- 네이티브: Ghidra, 네이티브 바이너리, C++ 재구성, 게임의 웹 이식.

임의의 앱을 원클릭으로 복제하는 제품이 아닙니다. skill은 증거 수집, 명세 작성, 구현, 검증 과정을 에이전트에게 안내할 뿐이며, 결과는 대상과 모델, 사용자의 검토에 달려 있습니다.

## Skills (41개)

| 분류        | 개수 | 라우터 skill   |
| ----------- | ---- | -------------- |
| app         | 8    | `app-index`    |
| web         | 10   | `web-index`    |
| shot        | 8    | `shot-index`   |
| mobile      | 7    | `mobile-index` |
| native      | 7    | `native-index` |
| 루트 라우터 | 1    | `replica`      |

skills 한 벌을 세 클라이언트가 공유합니다. `lib/`, `scripts/`, `references/`도 `skills/` 옆에서 공유됩니다. 개별 skill 폴더만 따로 복사하지 마세요.

## 사전 준비

- Git 또는 `gh` CLI.
- Node 22 권장(>=20), Python 3.13 권장, git.
- OS별 도구(Ghidra, jadx, apktool, Frida, Qt, 플랫폼 SDK)는 외부의 선택 사항이며 플러그인이 설치하지 않습니다.

clone (로컬 경로로 설치할 때 필요):

```bash
git clone https://github.com/yazzang-homelab/replica-suite.git
```

## 설치

아래 원격 소스 `yazzang-homelab/replica-suite` 대신 로컬 clone의 절대 경로를 써도 됩니다. 설치 후에는 새 세션을 시작하세요.

### Claude Code

```bash
claude plugin marketplace add yazzang-homelab/replica-suite
claude plugin install replica-suite@replica-suite-local
claude plugin list --json
```

새 세션에서 `/replica-suite:replica`를 실행합니다.

설치 없이 로컬 테스트:

```bash
claude --plugin-dir /absolute/path/to/replica-suite
```

### Codex

Codex는 루트 `plugin.json`(Agent Plugins 1.0 portable manifest)과 `.agents/plugins/marketplace.json`을 사용합니다. `.codex-plugin` fallback은 없습니다.

```bash
codex plugin marketplace add yazzang-homelab/replica-suite
codex plugin add replica-suite@replica-suite-local
codex plugin list --json
```

새 세션에서 `/skills` 또는 `$` 선택기를 열어 `replica-suite:replica`를 고릅니다.

### GJC

GJC는 이 저장소를 Claude 호환 마켓플레이스 provider로 읽습니다. 새 `gajae-plugin.json` 번들 형식은 최상위 skills를 지원하지 않으므로 쓰지 마세요. `gjc plugin install .`이나 번들용 `--user` 방식도 쓰지 마세요.

```bash
gjc plugin marketplace add yazzang-homelab/replica-suite
gjc plugin install replica-suite@replica-suite-local --scope user
gjc plugin list --json
gjc skills discover --query replica-suite --limit 50 --json
```

GJC 0.19.0에서 discover 결과는 41개 후보였습니다. 새 세션에서 `/skill:replica-suite:replica`를 실행합니다. 이 버전에서는 marketplace install의 `--dry-run`이 무시되므로 설치 검증에 쓰지 마세요.

### 로컬 clone으로 설치

세 클라이언트 모두 `marketplace add`에 절대 clone 경로를 쓸 수 있습니다. GJC는 디렉터리 전체를 복사하므로 `node_modules`와 `.venv`가 없는 깨끗한 checkout으로 설치한 뒤, 설치된 사본에 의존성을 준비하세요.

## 설치본 의존성

플러그인 관리자가 번들을 캐시로 복사할 수 있습니다. clone에만 의존성을 설치해도 그 캐시에는 적용되지 않습니다. 실제 루트는 선택한 `SKILL.md`에서(`root = Path(skill).resolve().parents[2]`) 또는 플러그인 관리자의 `installedPath`/`installPath`로 확인합니다.

Claude 로컬 마켓플레이스는 `claude plugin list --json`의 `readFromFolder`가 있으면 `installPath`보다 우선합니다. 실제 스킬을 읽는 경로에 의존성을 설치하세요.

`REPLICA_SUITE_ROOT`는 사용자가 직접 설정하는 변수이며 어떤 호스트도 제공하지 않습니다. 사용하는 같은 셸 호출 안에서 설정하세요.

```bash
export REPLICA_SUITE_ROOT="/absolute/path/to/installed/bundle"
npm ci --prefix "$REPLICA_SUITE_ROOT"
python3 -m venv "$REPLICA_SUITE_ROOT/.venv"
"$REPLICA_SUITE_ROOT/.venv/bin/python" -m pip install -r "$REPLICA_SUITE_ROOT/requirements.txt"
node "$REPLICA_SUITE_ROOT/node_modules/playwright/cli.js" install chromium
```

도구를 자동 설치하는 hook은 없습니다. 캐시가 갱신되면 다시 실행해야 할 수 있습니다. 자세한 내용: [references/runtime.md](references/runtime.md).

## 사용법

`replica`에서 시작하거나 분류 라우터 `app-index`, `web-index`, `shot-index`, `mobile-index`, `native-index`를 직접 호출합니다. 접두사는 호스트를 따릅니다(Claude Code는 `/replica-suite:web-index`, Codex 선택기는 `replica-suite:web-index`, GJC는 `/skill:replica-suite:web-index`).

예시:

1. 웹: 대상 URL을 주고 `web-index`로 캡처, 디자인 명세 작성, 재구현, 렌더 비교를 요청합니다.
2. 모바일: APK의 절대 경로를 주고 `mobile-index`로 패키지 구조와 API 호출의 증거를 정리하게 합니다.

각 skill에 필요한 입력과 출력이 적혀 있습니다. 입력과 출력은 절대 경로로 넘기세요.

## 검증

개발 저장소 루트에서 가상환경을 활성화한 뒤 실행합니다.

```bash
npm run check
npm run test:e2e
python3 scripts/check_clients.py --client all
```

`--client`는 `codex`, `claude`, `gjc`를 받습니다. `check_clients.py`는 클라이언트 실행 파일이 필요하고, 임시 격리 설정을 쓰며, 유료 모델 호출을 하지 않습니다. 테스트는 Python 회귀 테스트와 브라우저 e2e 3종이며 개수는 늘어날 수 있습니다.

테스트한 클라이언트 버전: Codex 0.164.0, Claude Code 2.1.310, GJC 0.19.0. 이전 버전은 보장하지 않습니다.

클라이언트 검사는 설치, skill 탐색, 공유 리소스를 확인합니다. 단위·브라우저 테스트는 도구 동작, 이미지 비교, 오프라인 재생도 확인합니다. 클라이언트 간 LLM 출력 동등성이나 실제 기기·Ghidra·Qt 기능을 검증한 것은 아닙니다.

플랫폼: 클라이언트 설치·탐색은 로컬 Linux에서, 단위·브라우저 테스트는 Ubuntu 24.04 CI에서 검증합니다. macOS와 Windows는 런타임 테스트를 하지 않았습니다. `.sh` 도우미는 POSIX 셸이 필요하고, Windows의 venv 인터프리터는 `.venv/Scripts/python.exe`입니다. 네이티브 도구는 플랫폼마다 다릅니다.

## 출처와 라이선스

원본 40개를 요청했고 39개를 clone해 검토했습니다. `minosdevs/copycat-skill`은 접근 불가(404)여서 통합하지 않았습니다. `upstreams.lock.json`과 `THIRD_PARTY_NOTICES.txt`를 참고하세요.

서드파티 라이선스 조건은 그대로 유지됩니다. 전체에 MIT를 적용한다는 주장은 하지 않습니다.

## 문제 해결

- clone이나 marketplace add 실패: 네트워크 연결 또는 `gh auth status`를 확인하세요.
- 설치 후 skill이 보이지 않음: 세션을 다시 시작하세요.
- 스크립트가 리소스를 찾지 못함: 개별 skill만 복사한 경우입니다. 번들 전체를 사용하세요.
- 브라우저나 시스템 라이브러리 누락: 설치본에 위 Playwright 설치를 다시 실행하세요.
- 클라이언트 동작 차이: 위의 테스트 버전과 비교하세요.
- GJC 설치 이상: `gjc plugin install .`이 아니라 marketplace 방식을 썼는지 확인하세요.
- 테스트의 설치 명령은 기존 사용자 설정을 덮어쓰지 않고 격리된 설정에서 실행됩니다.

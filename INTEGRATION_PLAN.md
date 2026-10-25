# 2차 통합 실행 계획

## 목표와 승인
사용자 요청: 1차 통합 이후의 작업을 계획하고 실행한다. 게시 대상은 `yazzang-homelab/reverse-anything`이며 비공개 설정을 확인한다. 로그인 승인은 사용자 기기 인증이 필요하다. 원격 저장소의 기존 내용을 확인하기 전에는 덮어쓰거나 강제 push하지 않는다.

## 조사에서 확인한 중복
- `app-brand-deploy/scripts/sweep.py`와 `web-mirror-rebrand/scripts/rebrand_scan.py`: 텍스트·파일명 브랜드 탐색, 파일 순회 및 보고를 중복 구현한다. 이름/도메인/색 검사와 명시적 치환을 하나의 CLI로 합친다.
- `app-parity-test/scripts/imgdiff.py`와 `web-verify-pixel/scripts/pixel_diff.py`: PNG chunk/filter/압축 해제를 직접 중복 구현한다. 이미 사용하는 Pillow 기반 공통 이미지 I/O로 대체한다.
- 브라우저 수집 도구들은 Chromium 실행과 글꼴/이미지 대기, 애니메이션 안정화를 중복 구현한다. 공통 실행 모듈로 모으되 상태 캡처·모바일 flow·WebGL 관측은 각 목적별로 유지한다.
- 분류 index들은 권한·증거·clean-room·검증 원칙을 반복한다. 공통 계약을 한 곳으로 옮기고 index는 분류별 예외만 추가한다.

## 합치지 않는 것
레이아웃 edge-density 점수, 원본 해상도 RGBA 차이, white-composited 영역별 진단, pixelmatch 지각 차이는 서로 다른 지표다. 하나의 정확도 점수로 변환하거나 단순히 파일 수를 줄이기 위해 의미를 바꾸지 않는다. React Native flow, 인터랙션 상태 캡처, WebGL runtime 미러도 동일한 기능이 아니다.

## 구현 순서와 파일 소유권
1. 독립 구현: 공통 브랜드 CLI + 회귀 테스트, 공통 PNG I/O + 두 소비자/회귀 테스트, 공통 브라우저 모듈 + 대표 소비자/회귀 테스트.
2. 통합: 나머지 브라우저 소비자를 확정된 공통 API에 연결한다. 앱·웹 스킬의 브랜드 명령을 새 CLI로 변경하고 구 스크립트 두 개는 삭제한다. 호환용 alias는 남기지 않는다.
3. 규칙: `references/common-contract.md`를 공통 계약으로 사용한다. 분류 index와 통합 진입점이 이를 읽도록 연결하고 대상별 고유 경계는 유지한다.
4. 검증 구조: 공통 lib까지 문법·출처·링크 검사에 포함한다. 이동/수정된 upstream 파생 파일은 실제 출처와 변경 공지를 보존한다. 삭제된 스크립트 참조를 검사한다.
5. 배포: 버전을 0.2.0으로 갱신하고 기존 0.1.0 ZIP은 보존하며 새 ZIP을 만든다. 원격 작업은 인증 상태와 저장소 가시성/기존 내용을 확인한 뒤 수행한다.

## 수락 기준
- 브랜드 탐색 구현은 하나이고 두 구 CLI는 없어야 한다. scan은 잔존 이름/도메인/색/경로를 감지하고 replace는 기본 dry-run이며 symlink/무효 설정을 안전하게 처리한다.
- PNG 디코더와 인코더는 Pillow 기반 단일 구현이다. 레이아웃의 white alpha 합성과 strict 비교의 RGBA 보존을 분리하여 유지한다. 팔레트/투명도/잘린 이미지/크기 제한을 테스트한다.
- 소비자들은 공유 브라우저 모듈을 import한다. stop-motion과 finish-animation은 명시적으로 구분하며 무한 대기를 허용하지 않는다. 기존 출력 파일·보고서 필드·exit code는 의미가 유지된다.
- 기존 테스트 + 새 회귀 테스트 + 실제 브라우저 캡처·시각 비교·offline runtime replay가 통과한다. 서로 다른 CWD에서 공유 모듈이 로드된다.
- 41개 스킬 및 출처 40개(39개 접근, 1개 미접근) 매핑을 유지하고 수정된 코드의 라이선스·해시를 재생성한다.
- 자동 검사 통과를 실제 모바일 기기/Ghidra/Qt 전체 시나리오 검증으로 과장하지 않는다.

## 비목표
새 분석 플랫폼 추가, 전체 도구 재작성, 지표의 무리한 단일화, upstream 실행 파일 자동 실행, 자격증명 채팅 수집, 강제 push.

## 로컬 실행 결과
- 브랜드 구 스크립트 두 개를 삭제하고 `scripts/brand.py`로 통합했다. 두 소비자의 명령과 scanner 전용 설정 파일 안내를 변경했다.
- Python PNG codec 두 개를 `lib/images.py`로 교체했다. Pillow가 팔레트/tRNS/interlaced PNG를 처리하며 기존 16-bit grayscale 고비트 변환과 layout의 floor alpha 합성을 테스트했다.
- 브라우저 소비자 6개가 `lib/browser.mjs`를 사용한다. 숨은 Chrome→Chromium fallback을 없애고 명시적 channel 선택으로 바꿨다. 폰트 대기가 이미지 대기에 암묵적으로 묶이는 결함도 시험으로 확인하여 수정했다.
- 통합 진입점 및 분류 라우터 5개는 공통 계약을 참조한다. 개별 스킬의 대상별 안전 조건과 서로 다른 시각 지표는 의도적으로 유지했다.
- `npm run check`: 70개 테스트 통과. `npm run test:e2e`: visual pipeline, offline runtime mirror, shared browser/mobile flow/canvas QA 세 묶음 통과. npm audit에서 알려진 취약점 0건.
- 플러그인·marketplace manifest 검증 통과. 공개 디렉터리 제출용 README/아이콘 경고는 남아 있으며 비공개 설치와 구분한다.
- GitHub 기기 인증 절차를 시작했다. 사용자 승인 전에는 인증·원격 비공개 여부·게시 완료를 주장하지 않는다.

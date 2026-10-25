---
name: mobile-unity-il2cpp
description: Unity IL2CPP 앱 분석, global-metadata.dat와 네이티브 바이너리 연결, 타입·메서드 복원 및 Ghidra/IDA 검증. Recover evidence-backed Unity behavior specifications for authorized game ports.
---

# Unity IL2CPP 분석과 이식 명세

## 권한·범위
자체 빌드 또는 분석 허가를 받은 패키지만 사용한다. 자산·코드·폰트의 사용 권리는 별도로 기록한다. 복원한 타입 이름이나 dummy DLL을 원본 소스 복구라고 부르지 않는다. 보호 해제나 유료 기능 우회를 기본 절차로 수행하지 않는다.

## 절차
1. `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/inspect_mobile.py" target.apk`로 멤버 목록과 해시, metadata 헤더를 조사한다. IPA도 지원한다. 도구는 패키지를 실행하거나 압축 해제하지 않는다.
2. 동일 빌드에서 나온 `libil2cpp.so` 또는 `UnityFramework`, `global-metadata.dat`, ABI, Unity 버전을 한 세트로 고정한다. 파일마다 SHA-256을 기록하고 다른 버전의 metadata를 섞지 않는다.
3. metadata magic `0xFAB11BAF`와 버전을 확인한다. 버전 번호만으로 Unity 버전을 단정하지 않는다. Il2CppDumper/Cpp2IL의 현재 지원 표와 실제 바이너리를 대조해 버전·커밋을 고정한다. 특정 포크가 최신 metadata를 지원한다는 upstream 주장도 설치한 도구에서 검증한다.
4. 읽기 전용 복사본과 빈 출력 폴더에서 분석한다. dump.cs, 타입 헤더, 메서드 매핑, 도구 로그를 보존한다. 비정상 종료를 정상 성공으로 취급하지 않는다. 출력이 일부 생성돼도 파싱·커버리지 검증 전에는 부분 결과다.
5. 생성된 import 스크립트를 실행 전 정독하고 IDA/Ghidra 프로젝트 사본에 적용한다. RVA/VA/파일 오프셋을 구분하며, 분석 도구 image base와 ASLR runtime base를 혼동하지 않는다.
6. 표본 메서드를 디스어셈블리·호출 관계·인수 타입과 대조한다. generic sharing이나 thunk 때문에 주소가 겹칠 수 있음을 기록한다. 함수 이름은 확정된 동작의 증거가 아니다. `native-ghidra`의 apply→cascade→verify 절차를 사용한다.
7. 입력, 장면 전환, 상태 저장, 물리·타이밍, 렌더링과 자산 로딩 계약을 추출한다. 권리가 확인된 자산은 매니페스트로 관리하고, 대체 자산은 별도 표시한다. 명세를 `native-game-port` 또는 `app-spec`으로 전달한다.

## 출력·완료 조건
`appclone/internals/unity/`에 `scope.json`, `package.json`, `toolchain.json`, `mapping/`, `sample-verification.json`, `behavior-spec.json`, `unknowns.json`을 둔다. 최소 세 메서드(세 개 미만이면 전부)를 주소 범위·함수 경계·참조에서 검증한다. 정적 분석과 실제 게임 실행 검증을 구분하여 보고한다.

## Sources
- P4nda0s/reverse-skills: rev-u3d-dump의 metadata/바이너리 매핑과 import 절차 검토. 라이선스 미확인으로 원문·코드는 포함하지 않는다.
- th3vib3coder/RevEng: 패키지 triage와 독립 parity 검토.
- zhaoxuya520/reverse-skill: 런타임별 분석 분기.

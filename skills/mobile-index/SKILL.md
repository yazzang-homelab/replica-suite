---
name: mobile-index
description: 모바일 앱 이식·재제작을 위한 Android APK, iOS IPA, Flutter, Unity, Frida 및 API 분석 분류 진입점. Route authorized mobile reverse engineering and reconstruction requests by runtime and evidence.
---

# 모바일 분석 라우터

## 시작 조건
[공통 실행 계약](../../references/common-contract.md)을 먼저 읽고 적용한다. 모바일 분석에서는 패키지 형식, ABI, 엔진 버전, 시험 장치 조건을 추가로 고정한다.

| 입력·목적 | 스킬 |
|---|---|
| APK/XAPK, Java/Kotlin, manifest, jadx | `mobile-android-apk` |
| IPA, Mach-O, ObjC/Swift | `mobile-ios-ipa` |
| libapp.so, Flutter, Dart AOT | `mobile-flutter-dart` |
| 승인된 장치의 호출·상태 관측 | `mobile-frida-runtime` |
| libil2cpp.so, UnityFramework, metadata | `mobile-unity-il2cpp` |
| API 후보를 검증된 자체 구현 계약으로 | `mobile-api-extraction` |
| 스크린샷만으로 React Native 구현 | `shot-to-rn` |
| 기능·데이터 모델·구현 계획 | `app-spec` |

## 연결 절차
1. 패키지 형식을 확인하고 언어가 아니라 실제 런타임으로 분기한다. Java wrapper만 보고 앱 전체가 Java라고 단정하지 않는다.
2. 정적 분석 → 필요한 동적 확인 → 증거 기반 명세 → 자체 구현 → parity 검증 순서를 따른다.
3. API는 시험용 데이터와 자체 서비스 계약으로 옮긴다. 수집한 자격증명을 재사용하거나 원본 백엔드에 테스트 부하를 주지 않는다.
4. 산출물은 `appclone/internals/` 아래 유형별로 저장하고 `appclone/` 기능 명세와 연결한다. 미확인 항목을 삭제하여 통과시키지 않는다.

## Sources / upstream 매핑
| 저장소 | 통합 위치 |
|---|---|
| SimoneAvogadro/android-reverse-engineering-skill | mobile-android-apk, mobile-api-extraction |
| incogbyte/android-reverse-engineering-claude-skill | mobile-android-apk, mobile-frida-runtime |
| inliver233/reverse-skills | mobile-flutter-dart, mobile-frida-runtime |
| incogbyte/iOS-reverse-engineering-claude-skill | mobile-ios-ipa, mobile-api-extraction |
| th3vib3coder/RevEng | mobile-android-apk, mobile-unity-il2cpp; native-ghidra |
| EncidXVII/claude-reverse-engineering-skill | mobile-android-apk, mobile-ios-ipa, mobile-api-extraction |
| zhaoxuya520/reverse-skill | mobile-index, mobile-frida-runtime; native-index |
| P4nda0s/reverse-skills | mobile-frida-runtime, mobile-unity-il2cpp; native-ghidra |

도구 미설치나 시험 장치 부재는 차단 사유로 명시한다. 문서 작성 완료와 실제 패키지 분석 검증 완료를 구분한다.

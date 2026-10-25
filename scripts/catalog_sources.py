#!/usr/bin/env python3
"""Regenerate provenance lock and complete third-party notices from local clones."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

PURPOSES = [
    "증거 기반 다중 런타임 조사 CLI/MCP", "앱 재구현의 조사·설계·구현·출시 및 parity 도구",
    "사용자 불만 조사와 clean-room 재제작 단계별 게이트", "스크린샷 중심 React Native 앱 재구현",
    "웹 미러·코드 복구·동등성 검증", "스크린샷·URL·HTML UI 재구현",
    "DOM·CSS·동작을 측정하는 웹 재구현", "상점 앱 및 clone-website 에이전트 스킬",
    "범용 스킬 모음 중 clone-website 워크플로", "캡처·구현·비교·수정 웹 harness",
    "미접근: 기능과 소스 미검증", "페이지 미러·시각 비교·브랜드 교체",
    "브라우저 증거와 독립 QA", "웹 캡처·복원·검증 및 임베딩",
    "WebGL·Three.js·Rive 런타임 재현", "사이트 디자인 규칙 추출",
    "Firecrawl/Playwright 분석", "재구현용 에이전트 템플릿",
    "스크린샷→HTML 및 실제 렌더 검증", "범용 스킬 모음 중 screenshot-to-code",
    "React·Vue·Svelte·HTML 화면 코드", "설계 시안·UI 코드 제작 절차",
    "디자인→UnoCSS 및 자산 정책 도구", "Qt Quick/QML UI 재구현",
    "시안·자산·프론트엔드 제작 파이프라인", "Android 정적 분석과 Kotlin·API 도구",
    "Android 코드·네트워크 흐름 분석", "Flutter/Dart AOT와 장치 ABI 분석",
    "iOS 패키지·Mach-O·API 분석", "저장소·바이너리·Android 조사 및 parity",
    "다중 패키지/바이너리 분석과 엔드포인트 스캔", "런타임과 목적별 분석 도구 라우팅",
    "Frida·IL2CPP·IDA 등 전문 분석 스킬", "증거 중심 바이너리 triage 및 검증",
    "Ghidra 원격 제어와 함수 분석", "반복적인 Ghidra 타입·심볼 수정과 신뢰 모델",
    "값 흐름 추적·빌드 비교·조사 재개", "IDA/radare2/JavaScript 분석 스킬",
    "바이너리 기반 C/C++ 재구성 및 비교", "게임 코드·자산 조사와 웹 이식",
]


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path)
    parser.add_argument("repos", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    repos = args.repos.read_text().splitlines()
    if len(repos) != 40:
        raise ValueError("Expected the 40 requested repositories")
    skill_texts = {p.parent.name: p.read_text() for p in (root / "skills").glob("*/SKILL.md")}
    code = [p for base in (root / "skills", root / "scripts", root / "lib")
            for p in base.rglob("*") if p.is_file()
            and p.suffix in {".py", ".sh", ".js", ".mjs"}]
    catalog = []
    notices = ["THIRD-PARTY NOTICES\n\nOriginal integration files are private; third-party rights remain unchanged.\n"
               "The following full upstream licenses apply to the listed copied/adapted files.\n"
               "Consult upstreams.lock.json for full commit IDs and file hashes.\n"]
    for index, repo in enumerate(repos, 1):
        source = args.sources / (f"{index:02d}-" + repo.replace("/", "_"))
        row = {"id": index, "repository": repo, "url": "https://github.com/" + repo,
               "category": "A" if index <= 5 else "B" if index <= 18 else "C" if index <= 25 else "D" if index <= 33 else "E",
               "purpose": PURPOSES[index - 1]}
        if not (source / ".git").exists():
            row.update(status="unavailable", reason="Clone failed; unauthenticated GitHub API returned 404. Not analyzed.", skills=[])
            catalog.append(row)
            continue
        files = git(source, "ls-files", "-z").split("\0")
        licenses = [p for p in source.iterdir() if p.is_file()
                    and p.name.lower().split(".")[0] in {"license", "licence", "copying", "unlicense"}]
        text = "\n".join(p.read_text(errors="replace") for p in licenses)
        if "Apache License" in text:
            license_id = "Apache-2.0"
        elif "MIT License" in text or "Permission is hereby granted, free of charge" in text:
            license_id = "MIT"
        elif "public domain" in text.lower() and "unlicense" in text.lower():
            license_id = "Unlicense"
        elif "GNU GENERAL PUBLIC LICENSE" in text:
            license_id = "GPL (see upstream license for version and terms)"
        else:
            license_id = "not detected; review required" if licenses else "no root license found"
        copied = []
        for path in code:
            header = "\n".join(path.read_text().splitlines()[:20])
            if "no upstream code copied" in header.lower():
                continue
            if repo.lower() in header.lower() and any(term in header.lower() for term in ("copied", "vendored", "credit:", "source:", "adapted from", "derived from")):
                copied.append(path)
        if index == 23:
            copied += [root / "skills/shot-to-unocss/asset-policy.config.json"]
        if index == 26:
            copied += [root / "skills/mobile-android-apk/references/third_party_hosts.txt"]
        copied = sorted(set(copied))
        if copied and not licenses:
            raise ValueError(f"Copied files without a root license: {repo}")
        row.update(status="cloned", commit=git(source, "rev-parse", "HEAD"),
                   tracked_file_count=len([p for p in files if p]),
                   license=license_id, license_files=[p.name for p in licenses],
                   entrypoints=sorted(p for p in files if p.endswith("SKILL.md") or p.lower() == "readme.md"),
                   skills=sorted(name for name, body in skill_texts.items() if repo.lower() in body.lower()),
                   bundled_files=[{"path": str(p.relative_to(root)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
                                  for p in copied],
                   analysis_scope="Relevant skills, helpers and documentation; not an exhaustive audit or execution of upstream projects.")
        catalog.append(row)
        if copied:
            notices.append(f"\n{'=' * 72}\n{repo}\nCommit: {row['commit']}\nFiles:\n" +
                           "\n".join("  " + str(p.relative_to(root)) for p in copied) + "\n")
            for path in licenses:
                notices.append(f"\n--- {path.name} (verbatim) ---\n" + path.read_text())
            for path in source.iterdir():
                if path.is_file() and path.name.lower().split(".")[0] == "notice":
                    notices.append(f"\n--- {path.name} (verbatim) ---\n" + path.read_text())
    (root / "upstreams.lock.json").write_text(json.dumps({"schema": 1, "repositories": catalog}, ensure_ascii=False, indent=2) + "\n")
    (root / "THIRD_PARTY_NOTICES.txt").write_text("\n".join(notices))
    print(f"Recorded {len(catalog)} repositories; {sum(bool(r.get('bundled_files')) for r in catalog)} bundled sources")


if __name__ == "__main__":
    main()

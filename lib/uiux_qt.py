#!/usr/bin/env python3
"""QWidget 기하·텍스트·접근 이름 검사. 앱 생성·종료와 프로젝트 import는 하지 않는다.

실행 중인 신뢰할 수 있는 앱에서 ``audit_widgets(window)``를 호출한다. 스냅샷 CLI는
JSON 데이터만 읽으며 실제 렌더링 여부를 검증할 수 없으므로 정상이어도 incomplete다.
PySide6는 실시간 API를 호출할 때만 불러온다.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import platform
import re
import sys
import tempfile
from typing import Any


_MAX_BYTES = 2 * 1024 * 1024
_MAX_WIDGETS = 10_000
_MAX_COORDINATE = 10_000_000
_FIELDS = {
    "id", "kind", "rect", "parent_rect", "text", "text_width", "text_height",
    "available_width", "available_height", "interactive", "accessible_name",
    "scroll_content", "visible",
}
_OPTIONAL_FIELDS = {"accessible_name_source"}
_NAME_SOURCES = {"explicit", "buddy", "computed", "empty"}
_LIMITATIONS = [
    "검사 범위는 표시된 QWidget의 부모 경계, 단순 텍스트 크기, 이름 없는 아이콘 버튼이다.",
    "사용 흐름, 키보드 순서, 대비, 화면 읽기 프로그램, 미적 품질과 다른 OS의 동작은 검증하지 않는다.",
    "텍스트 크기 측정은 QLabel과 QPushButton을 대상으로 하며 rich text 및 elide 동작은 별도 검토가 필요하다.",
    "QLabel AutoText의 < 또는 & 포함 텍스트는 Qt rich text 판별을 추정하지 않고 미측정으로 남긴다.",
    "텍스트 없는 버튼의 계산 접근 이름은 출처를 특정할 수 없으면 컨테이너 제목일 수 있어 incomplete다.",
]


def _number(value: Any, name: str, *, nonnegative: bool = False) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name}: 유한한 숫자가 필요하다")
    # 큰 Python int를 math.isfinite에서 float로 변환하기 전에 범위를 거부한다.
    if abs(value) > _MAX_COORDINATE or not math.isfinite(value):
        raise ValueError(f"{name}: 숫자가 허용 범위를 벗어났다")
    if nonnegative and value < 0:
        raise ValueError(f"{name}: 음수 크기는 허용하지 않는다")
    return float(value)


def _rectangle(value: Any, name: str) -> None:
    if not isinstance(value, list) or len(value) != 4:
        raise ValueError(f"{name}: [x, y, width, height]가 필요하다")
    for index, item in enumerate(value):
        _number(item, f"{name}[{index}]", nonnegative=index >= 2)


def validate_snapshot(snapshot: Any) -> dict:
    """외부 JSON 수치를 사용하기 전에 구조·범위·중복을 검사한다."""
    if not isinstance(snapshot, dict) or set(snapshot) != {"schema_version", "widgets"}:
        raise ValueError("스냅샷에는 schema_version, widgets만 필요하다")
    if type(snapshot["schema_version"]) is not int or snapshot["schema_version"] != 1:
        raise ValueError("지원하는 schema_version은 1이다")
    widgets = snapshot["widgets"]
    if not isinstance(widgets, list) or not 1 <= len(widgets) <= _MAX_WIDGETS:
        raise ValueError(f"widgets는 1~{_MAX_WIDGETS}개여야 한다")
    ids = set()
    for index, widget in enumerate(widgets):
        prefix = f"widgets[{index}]"
        if (not isinstance(widget, dict) or not _FIELDS.issubset(widget) or
                set(widget) - (_FIELDS | _OPTIONAL_FIELDS)):
            raise ValueError(f"{prefix}: 필드가 누락되었거나 알 수 없는 필드가 있다")
        for field in ("id", "kind", "text", "accessible_name"):
            value = widget[field]
            if not isinstance(value, str) or len(value) > (100_000 if field == "text" else 1024):
                raise ValueError(f"{prefix}.{field}: 문자열 형식 또는 길이가 잘못되었다")
        if not widget["id"].strip() or not widget["kind"].strip():
            raise ValueError(f"{prefix}: id와 kind는 비어 있을 수 없다")
        if widget["id"] in ids:
            raise ValueError(f"{prefix}: 중복 id")
        ids.add(widget["id"])
        _rectangle(widget["rect"], prefix + ".rect")
        if widget["parent_rect"] is not None:
            _rectangle(widget["parent_rect"], prefix + ".parent_rect")
        for field in ("text_width", "text_height", "available_width", "available_height"):
            _number(widget[field], prefix + "." + field, nonnegative=True)
        for field in ("interactive", "scroll_content", "visible"):
            if type(widget[field]) is not bool:
                raise ValueError(f"{prefix}.{field}: boolean이 필요하다")
        if "accessible_name_source" in widget:
            source = widget["accessible_name_source"]
            if not isinstance(source, str) or source not in _NAME_SOURCES:
                raise ValueError(f"{prefix}.accessible_name_source: 알 수 없는 이름 출처")
            if (source == "empty") != (not widget["accessible_name"].strip()):
                raise ValueError(f"{prefix}: 접근 이름과 출처가 모순된다")
    return snapshot


def _check(check_id: str, passed: bool, message: str, widget: dict) -> dict:
    return {
        "id": check_id,
        "status": "pass" if passed else "fail",
        "message": message,
        "evidence": {"widget_id": widget["id"], "kind": widget["kind"]},
    }


def _audit(snapshot: dict, *, live: bool, environment: dict) -> dict:
    validate_snapshot(snapshot)
    checks = []
    visible = [widget for widget in snapshot["widgets"] if widget["visible"]]
    if not visible:
        checks.append({"id": "qt.visible", "status": "incomplete", "message": "표시된 QWidget이 없다"})
    for widget in visible:
        ident = widget["id"]
        parent = widget["parent_rect"]
        if parent is not None and not widget["scroll_content"]:
            x, y, width, height = widget["rect"]
            px, py, pw, ph = parent
            inside = x >= px and y >= py and x + width <= px + pw and y + height <= py + ph
            entry = _check(f"qt.bounds:{ident}", inside, "부모 영역 안에 표시" if inside else "부모 영역을 벗어난 QWidget", widget)
            entry["evidence"].update(rect=widget["rect"], parent_rect=parent)
            checks.append(entry)
        if widget["text"]:
            if widget["text_width"] == 0 and widget["text_height"] == 0:
                checks.append({
                    "id": f"qt.text:{ident}", "status": "incomplete",
                    "message": "이 텍스트 위젯의 렌더링 크기를 측정하지 않았다",
                    "evidence": {"widget_id": ident, "kind": widget["kind"]},
                })
            else:
                # 1px은 정수 기하와 폰트의 소수점 측정 사이 반올림 차이만 흡수한다.
                fits = (widget["text_width"] <= widget["available_width"] + 1 and
                        widget["text_height"] <= widget["available_height"] + 1)
                entry = _check(f"qt.text:{ident}", fits, "텍스트 표시 공간 확보" if fits else "텍스트 크기보다 표시 공간이 작다", widget)
                entry["evidence"].update(
                    measured=[widget["text_width"], widget["text_height"]],
                    available=[widget["available_width"], widget["available_height"]],
                )
                checks.append(entry)
        if widget["interactive"] and not _visible_text(widget["text"]).strip():
            named = bool(widget["accessible_name"].strip())
            source = widget.get("accessible_name_source")
            entry = _check(f"qt.name:{ident}", named,
                           "아이콘 버튼의 접근 이름 존재" if named else "텍스트 없는 버튼에 접근 이름이 없다", widget)
            if named and live and source not in {"explicit", "buddy"}:
                entry["status"] = "incomplete"
                entry["message"] = "계산 접근 이름의 출처를 확인하지 못했다. 버튼 자체의 이름인지 검토가 필요하다."
            entry["evidence"].update(accessible_name=widget["accessible_name"],
                                     accessible_name_source=source or "unreported")
            checks.append(entry)
    if not checks:
        checks.append({"id": "qt.coverage", "status": "incomplete", "message": "적용 가능한 검사 항목이 없다"})
    if not live:
        checks.append({
            "id": "qt.runtime", "status": "incomplete",
            "message": "입력 스냅샷의 수치만 검사했다. 실제 앱 실행과 렌더링은 검증하지 않았다.",
        })
    status = "fail" if any(c["status"] == "fail" for c in checks) else (
        "incomplete" if any(c["status"] == "incomplete" for c in checks) else "pass")
    return {
        "schema_version": 1, "kind": "qt", "status": status, "environment": environment,
        "checks": checks, "artifacts": [], "limitations": list(_LIMITATIONS),
    }


def audit_snapshot(snapshot: dict) -> dict:
    """스냅샷 검사. 위반은 fail, 위반 없는 정적 입력은 incomplete다."""
    return _audit(snapshot, live=False, environment={"platform": platform.system(), "backend": "snapshot"})


def _visible_text(text: str) -> str:
    # Qt mnemonic에서 &&는 리터럴 &, 단독 &는 단축키 표식이다.
    return re.sub(r"&(.)", lambda match: "&" if match[1] == "&" else match[1], text)


def snapshot_widgets(root: Any) -> dict:
    """이미 표시된 앱을 읽는다. 이벤트 처리나 위젯 속성 변경은 수행하지 않는다."""
    from PySide6.QtCore import Qt
    from PySide6.QtGui import QAccessible
    from PySide6.QtWidgets import (
        QAbstractButton, QAbstractScrollArea, QApplication, QLabel, QPushButton,
        QStyle, QStyleOptionButton, QWidget,
    )
    if not isinstance(root, QWidget):
        raise TypeError("root는 QWidget이어야 한다")
    if QApplication.instance() is None:
        raise RuntimeError("기존 QApplication이 필요하다")
    items = [root, *root.findChildren(QWidget)]
    # 루트가 하위 위젯이어도 같은 창의 실제 QLabel buddy 관계를 찾는다.
    buddy_names = {}
    scope = root.window()
    labels = ([scope] if isinstance(scope, QLabel) else []) + scope.findChildren(QLabel)
    for label in labels:
        target = label.buddy()
        if target is not None and label.text().strip():
            # 복잡한 rich text의 이름은 여기서 다시 해석하지 않는다. Qt가 계산한
            # 이름과 단순 buddy 문구가 일치할 때만 출처가 확인된 이름으로 인정한다.
            name = _visible_text(label.text()).strip()
            if name and "<" not in label.text():
                buddy_names.setdefault(target, set()).add(name)
    widgets = []
    for index, widget in enumerate(items):
        parent = widget.parentWidget() if widget is not root and not widget.isWindow() else None
        rect = widget.geometry()
        content = widget.contentsRect()
        text = ""
        measured_width = measured_height = 0.0
        available_width = float(max(0, content.width()))
        available_height = float(max(0, content.height()))
        if isinstance(widget, QLabel):
            text = widget.text()
            # AutoText는 엔티티도 rich text로 처리할 수 있다. Python에 노출되지 않은
            # mightBeRichText를 정규식으로 흉내 내지 않고 모호한 경우는 미측정으로 둔다.
            plain = widget.textFormat() == Qt.TextFormat.PlainText or (
                widget.textFormat() == Qt.TextFormat.AutoText and
                "<" not in text and "&" not in text)
            if plain:
                display_text = _visible_text(text) if widget.buddy() is not None else text
                available_width = float(max(0, content.width() - 2 * widget.margin() - max(0, widget.indent())))
                available_height = float(max(0, content.height() - 2 * widget.margin()))
                fm = widget.fontMetrics()
                if widget.wordWrap():
                    bounds = fm.boundingRect(0, 0, int(available_width), _MAX_COORDINATE,
                                             int(Qt.TextFlag.TextWordWrap), display_text)
                    measured_width, measured_height = float(bounds.width()), float(bounds.height())
                else:
                    lines = display_text.split("\n")
                    measured_width = float(max((fm.horizontalAdvance(line) for line in lines), default=0))
                    measured_height = float(fm.height() + fm.lineSpacing() * (len(lines) - 1)) if text else 0.0
        elif isinstance(widget, QPushButton):
            text = widget.text()
            option = QStyleOptionButton()
            option.initFrom(widget)
            option.text = text
            option.icon = widget.icon()
            option.iconSize = widget.iconSize()
            available = widget.style().subElementRect(QStyle.SubElement.SE_PushButtonContents, option, widget)
            available_width = float(max(0, available.width()))
            available_height = float(max(0, available.height()))
            if not widget.icon().isNull():
                available_width = max(0.0, available_width - widget.iconSize().width() - 4)
            fm = widget.fontMetrics()
            lines = _visible_text(text).split("\n")
            measured_width = float(max((fm.horizontalAdvance(line) for line in lines), default=0))
            measured_height = float(fm.height() + fm.lineSpacing() * (len(lines) - 1)) if text else 0.0
        elif isinstance(widget, QAbstractButton):
            # 체크/라디오/도구 버튼은 텍스트 유무만 읽고 전용 스타일 기하는 판정하지 않는다.
            text = widget.text()
            available_width = measured_width = 0.0
            available_height = measured_height = 0.0
        scroll_content = False
        if parent is not None:
            ancestor = parent.parentWidget()
            scroll_content = isinstance(ancestor, QAbstractScrollArea) and ancestor.viewport() is parent
        # Qt가 buddy 관계 등으로 계산한 실제 접근 이름을 읽는다. 명시 속성만 읽으면
        # 표준 QFormLayout의 이름 있는 무텍스트 체크박스를 이름 없음으로 오인한다.
        accessible = QAccessible.queryAccessibleInterface(widget)
        accessible_name = (accessible.text(QAccessible.Text.Name) if accessible is not None
                           else widget.accessibleName())
        if not accessible_name.strip():
            name_source = "empty"
        elif widget.accessibleName().strip():
            name_source = "explicit"
        elif accessible_name.strip() in buddy_names.get(widget, set()):
            name_source = "buddy"
        else:
            name_source = "computed"
        widgets.append({
            "id": f"{widget.objectName() or type(widget).__name__}:{index}",
            "kind": type(widget).__name__,
            "rect": [rect.x(), rect.y(), rect.width(), rect.height()],
            "parent_rect": [0, 0, parent.width(), parent.height()] if parent else None,
            "text": text, "text_width": measured_width, "text_height": measured_height,
            "available_width": available_width, "available_height": available_height,
            "interactive": isinstance(widget, QAbstractButton),
            "accessible_name": accessible_name, "scroll_content": scroll_content,
            "accessible_name_source": name_source,
            "visible": widget.isVisible() and widget.isVisibleTo(root),
        })
    return validate_snapshot({"schema_version": 1, "widgets": widgets})


def audit_widgets(root: Any) -> dict:
    """현재 QWidget을 실제로 읽어 검사한다. 사용자 앱을 import하거나 실행하지 않는다."""
    from PySide6 import __version__ as pyside_version
    from PySide6.QtCore import qVersion
    from PySide6.QtWidgets import QApplication
    snapshot = snapshot_widgets(root)
    return _audit(snapshot, live=True, environment={
        "platform": platform.system(), "backend": "QWidget", "pyside_version": pyside_version,
        "qt_version": qVersion(), "qpa_platform": QApplication.platformName(),
    })


def _atomic_json(path: Path, result: dict) -> None:
    if path.is_symlink():
        raise ValueError("출력 경로는 심볼릭 링크일 수 없다")
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".uiux-qt-", delete=False)
    try:
        with handle:
            json.dump(result, handle, ensure_ascii=False, allow_nan=False, indent=2)
            handle.write("\n")
        os.replace(handle.name, path)
    finally:
        Path(handle.name).unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Qt 스냅샷의 기하·텍스트·접근 이름 검사")
    parser.add_argument("--snapshot", type=Path, required=True, help="실행할 코드가 아닌 JSON 스냅샷")
    parser.add_argument("--out", type=Path, help="JSON 보고서 경로. 생략 시 stdout")
    args = parser.parse_args(argv)
    try:
        with args.snapshot.open("rb") as stream:
            payload = stream.read(_MAX_BYTES + 1)
        if len(payload) > _MAX_BYTES:
            raise ValueError("스냅샷은 2 MiB 이하여야 한다")
        def reject_constant(value):
            raise ValueError(f"허용하지 않는 JSON 숫자: {value}")

        def unique_object(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError(f"중복 JSON 키: {key}")
                result[key] = value
            return result

        snapshot = json.loads(payload.decode("utf-8"), parse_constant=reject_constant,
                              object_pairs_hook=unique_object)
        result = audit_snapshot(snapshot)
        if args.out:
            _atomic_json(args.out, result)
        else:
            print(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2))
        return {"pass": 0, "fail": 1, "incomplete": 3}[result["status"]]
    except (OSError, UnicodeError, ValueError, TypeError, OverflowError, RecursionError) as exc:
        print(json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

"""입력/정책 단위 검사와 선택적 실제 offscreen QWidget 검사를 구분한다."""
import copy
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from lib.uiux_qt import audit_snapshot, audit_widgets, snapshot_widgets, validate_snapshot


ROOT = Path(__file__).resolve().parents[1]


def specimen(**changes):
    widget = {
        "id": "label:0", "kind": "QLabel", "rect": [0, 0, 160, 32],
        "parent_rect": [0, 0, 320, 200], "text": "상태", "text_width": 24,
        "text_height": 16, "available_width": 160, "available_height": 32,
        "interactive": False, "accessible_name": "", "scroll_content": False,
        "visible": True,
    }
    widget.update(changes)
    return {"schema_version": 1, "widgets": [widget]}


class SnapshotTests(unittest.TestCase):
    def test_normal_snapshot_does_not_claim_runtime_pass(self):
        result = audit_snapshot(specimen())
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["environment"]["backend"], "snapshot")
        self.assertTrue(any(check["id"] == "qt.runtime" for check in result["checks"]))

    def test_unmeasured_text_is_explicitly_incomplete(self):
        result = audit_snapshot(specimen(text_width=0, text_height=0))
        text_check = next(check for check in result["checks"] if check["id"].startswith("qt.text"))
        self.assertEqual(text_check["status"], "incomplete")

    def test_three_independent_defects_are_detected(self):
        snapshot = specimen(rect=[300, 0, 160, 32], text="", text_width=250,
                            interactive=True)
        # 이름 누락은 빈 텍스트 버튼, 클리핑은 별도 label로 재현한다.
        label = copy.deepcopy(specimen(text_width=250)["widgets"][0])
        label["id"] = "label:1"
        snapshot["widgets"].append(label)
        result = audit_snapshot(snapshot)
        failed = [check["id"].split(":")[0] for check in result["checks"] if check["status"] == "fail"]
        self.assertEqual(sorted(failed), ["qt.bounds", "qt.name", "qt.text"])
        self.assertEqual(result["status"], "fail")

    def test_expected_scroll_overflow_is_exempt(self):
        result = audit_snapshot(specimen(rect=[-200, -100, 900, 700], scroll_content=True))
        self.assertFalse(any(check["status"] == "fail" for check in result["checks"]))

    def test_hidden_widgets_are_not_reported_as_rendered_defects(self):
        result = audit_snapshot(specimen(visible=False, text_width=999))
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual([check["id"] for check in result["checks"]], ["qt.visible", "qt.runtime"])

    def test_accessible_name_resolves_icon_button(self):
        result = audit_snapshot(specimen(text="", interactive=True, accessible_name="재생"))
        self.assertEqual(next(check for check in result["checks"] if check["id"].startswith("qt.name"))["status"], "pass")

    def test_name_source_is_optional_and_validated(self):
        # 기존 version=1 snapshot과 이름 출처를 추가한 snapshot 모두 읽는다.
        self.assertEqual(audit_snapshot(specimen())["status"], "incomplete")
        for source in ("explicit", "buddy", "computed", "empty"):
            snapshot = specimen(accessible_name="" if source == "empty" else "재생",
                                accessible_name_source=source)
            self.assertIs(validate_snapshot(snapshot), snapshot)
        for source in ("unknown", None, [], True):
            with self.subTest(source=source), self.assertRaises(ValueError):
                validate_snapshot(specimen(accessible_name_source=source))
        for name, source in (("재생", "empty"), ("", "explicit")):
            with self.subTest(name=name, source=source), self.assertRaises(ValueError):
                validate_snapshot(specimen(accessible_name=name, accessible_name_source=source))

    def test_invalid_shapes_types_ranges_and_duplicates_are_rejected(self):
        invalid = [None, {}, {"schema_version": True, "widgets": []}, {"schema_version": 1, "widgets": []}]
        for changes in ({"rect": [0, 0, -1, 20]}, {"rect": [0, 0, math.nan, 20]},
                        {"text_width": math.inf}, {"available_width": True},
                        {"text_height": -1}, {"visible": 1}, {"id": ""},
                        {"rect": [0, 0, 10 ** 399, 20]},
                        {"parent_rect": [0, 0, 1e20, 3]}, {"mystery": "x"}):
            invalid.append(specimen(**changes))
        duplicate = specimen()
        duplicate["widgets"] *= 2
        invalid.append(duplicate)
        for value in invalid:
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                validate_snapshot(value)

    def test_cli_valid_snapshot_exit_three_and_output(self):
        with tempfile.TemporaryDirectory() as directory:
            source, output = Path(directory) / "snapshot.json", Path(directory) / "report.json"
            source.write_text(json.dumps(specimen()), encoding="utf-8")
            result = subprocess.run([sys.executable, str(ROOT / "lib/uiux_qt.py"), "--snapshot", str(source), "--out", str(output)],
                                    cwd=directory, text=True, capture_output=True, timeout=15)
            self.assertEqual(result.returncode, 3, result.stderr)
            self.assertEqual(json.loads(output.read_text())["status"], "incomplete")
            self.assertEqual(result.stdout, "")

    def test_cli_malformed_json_nonfinite_and_oversize_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "bad.json"
            for content in ("{", json.dumps(specimen(text_width=math.nan)),
                            '{"schema_version":0,"schema_version":1,"widgets":[]}',
                            " " * (2 * 1024 * 1024 + 1)):
                source.write_text(content, encoding="utf-8")
                result = subprocess.run([sys.executable, str(ROOT / "lib/uiux_qt.py"), "--snapshot", str(source)],
                                        text=True, capture_output=True, timeout=15)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(json.loads(result.stderr)["status"], "error")
                self.assertEqual(result.stdout, "")

    def test_cli_huge_integer_and_deep_json_are_input_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "extreme.json"
            cases = (json.dumps(specimen(rect=[0, 0, 10 ** 399, 20])), "[" * 2000 + "]" * 2000)
            for content in cases:
                source.write_text(content, encoding="utf-8")
                result = subprocess.run([sys.executable, str(ROOT / "lib/uiux_qt.py"), "--snapshot", str(source)],
                                        text=True, capture_output=True, timeout=15)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(json.loads(result.stderr)["status"], "error")
                self.assertNotIn("Traceback", result.stderr)
                self.assertEqual(result.stdout, "")


HAS_QT = importlib.util.find_spec("PySide6") is not None


@unittest.skipUnless(HAS_QT, "실제 QWidget 검사는 PySide6가 있는 인터프리터에서 별도로 실행한다")
class QWidgetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        from PySide6.QtWidgets import QApplication
        cls.app = QApplication.instance() or QApplication([])

    def test_real_widgets_three_defects_then_zero(self):
        from PySide6.QtCore import Qt
        from PySide6.QtWidgets import QLabel, QPushButton, QWidget
        root = QWidget()
        root.setObjectName("root")
        root.resize(500, 300)
        label = QLabel("상태 표시가 아주 긴 텍스트", root)
        label.setObjectName("clipped")
        label.setGeometry(10, 10, 20, 40)
        outside = QWidget(root)
        outside.setObjectName("outside")
        outside.setGeometry(480, 100, 80, 50)
        icon = QPushButton("", root)
        icon.setObjectName("icon")
        icon.setGeometry(10, 100, 80, 40)
        root.show()
        self.app.processEvents()
        try:
            bad = audit_widgets(root)
            failures = [check["id"].split(":")[0] for check in bad["checks"] if check["status"] == "fail"]
            self.assertEqual(sorted(failures), ["qt.bounds", "qt.name", "qt.text"], bad)
            label.resize(400, 40)
            outside.move(350, 100)
            icon.setAccessibleName("재생")
            self.app.processEvents()
            good = audit_widgets(root)
            self.assertEqual(good["status"], "pass", good)
            self.assertEqual(good["environment"]["backend"], "QWidget")
            self.assertEqual(good["environment"]["qpa_platform"], "offscreen")
            self.assertFalse(any(check["status"] == "fail" for check in good["checks"]))
            self.assertTrue(root.isVisible(), "검사 도구가 창을 닫으면 안 된다")
        finally:
            root.close()

    def test_form_buddy_effective_accessible_name_is_recognized(self):
        from PySide6.QtGui import QAccessible
        from PySide6.QtWidgets import QCheckBox, QFormLayout, QWidget
        root = QWidget()
        layout = QFormLayout(root)
        checkbox = QCheckBox()
        layout.addRow("자동 저장", checkbox)
        root.show()
        self.app.processEvents()
        try:
            self.assertEqual(checkbox.accessibleName(), "")
            actual_name = QAccessible.queryAccessibleInterface(checkbox).text(QAccessible.Text.Name)
            self.assertEqual(actual_name, "자동 저장")
            snapshot = snapshot_widgets(root)
            observed = next(widget for widget in snapshot["widgets"] if widget["kind"] == "QCheckBox")
            self.assertEqual(observed["accessible_name"], actual_name)
            self.assertEqual(observed["accessible_name_source"], "buddy")
            self.assertEqual(audit_widgets(root)["status"], "pass")
        finally:
            root.close()

    def test_group_title_fallback_is_incomplete_until_names_are_explicit(self):
        from PySide6.QtWidgets import QApplication, QGroupBox, QPushButton, QStyle, QVBoxLayout
        group = QGroupBox("서식")
        layout = QVBoxLayout(group)
        buttons = []
        for icon in (QStyle.StandardPixmap.SP_DialogSaveButton, QStyle.StandardPixmap.SP_DialogCancelButton):
            button = QPushButton()
            button.setIcon(QApplication.style().standardIcon(icon))
            layout.addWidget(button)
            buttons.append(button)
        group.show()
        self.app.processEvents()
        try:
            snapshot = snapshot_widgets(group)
            button_records = [widget for widget in snapshot["widgets"] if widget["kind"] == "QPushButton"]
            self.assertEqual([widget["accessible_name"] for widget in button_records], ["서식", "서식"])
            self.assertEqual([widget["accessible_name_source"] for widget in button_records], ["computed", "computed"])
            result = audit_widgets(group)
            self.assertEqual(result["status"], "incomplete", result)
            name_checks = [check for check in result["checks"] if check["id"].startswith("qt.name:")]
            self.assertEqual([check["status"] for check in name_checks], ["incomplete", "incomplete"])
            self.assertEqual([check["evidence"]["accessible_name"] for check in name_checks], ["서식", "서식"])
            for button, name in zip(buttons, ("저장", "취소")):
                button.setAccessibleName(name)
            self.app.processEvents()
            corrected = audit_widgets(group)
            self.assertEqual(corrected["status"], "pass", corrected)
            self.assertEqual(
                [check["evidence"]["accessible_name_source"] for check in corrected["checks"] if check["id"].startswith("qt.name:")],
                ["explicit", "explicit"],
            )
        finally:
            group.close()

    def test_auto_text_entity_is_incomplete_instead_of_false_failure(self):
        from PySide6.QtCore import Qt
        from PySide6.QtWidgets import QLabel
        auto = QLabel("a &lt; b")
        plain = QLabel("a &lt; b")
        plain.setTextFormat(Qt.TextFormat.PlainText)
        self.assertLess(auto.sizeHint().width(), plain.sizeHint().width())
        auto.setFixedSize(auto.sizeHint())
        plain.setFixedSize(plain.sizeHint())
        auto.show()
        plain.show()
        self.app.processEvents()
        try:
            result = audit_widgets(auto)
            self.assertEqual(result["status"], "incomplete", result)
            self.assertFalse(any(check["status"] == "fail" for check in result["checks"]))
            self.assertEqual(audit_widgets(plain)["status"], "pass")
        finally:
            auto.close()
            plain.close()

    def test_real_scroll_panel_and_word_wrap_are_measured_correctly(self):
        from PySide6.QtWidgets import QLabel, QScrollArea, QWidget
        root = QWidget()
        root.resize(500, 300)
        area = QScrollArea(root)
        area.setGeometry(0, 0, 200, 100)
        content = QWidget()
        content.resize(600, 400)
        area.setWidget(content)
        label = QLabel("여러 줄로 표시할 텍스트가 길어도 높이가 충분하면 잘리지 않습니다.", root)
        label.setWordWrap(True)
        label.setGeometry(220, 10, 200, 170)
        root.show()
        self.app.processEvents()
        area.horizontalScrollBar().setValue(200)
        area.verticalScrollBar().setValue(100)
        self.app.processEvents()
        try:
            snapshot = snapshot_widgets(root)
            self.assertTrue(any(widget["scroll_content"] for widget in snapshot["widgets"]))
            good = audit_widgets(root)
            self.assertEqual(good["status"], "pass", good)
            label.resize(200, 10)
            self.app.processEvents()
            bad = audit_widgets(root)
            self.assertTrue(any(check["id"].startswith("qt.text") and check["status"] == "fail" for check in bad["checks"]))
        finally:
            root.close()

    def test_hidden_root_and_invalid_object_do_not_get_runtime_pass(self):
        from PySide6.QtWidgets import QWidget
        root = QWidget()
        self.assertEqual(audit_widgets(root)["status"], "incomplete")
        with self.assertRaises(TypeError):
            audit_widgets(object())

    def test_rich_text_and_empty_window_do_not_get_runtime_pass(self):
        from PySide6.QtWidgets import QLabel, QWidget
        root = QWidget()
        root.resize(500, 200)
        root.show()
        self.app.processEvents()
        try:
            self.assertEqual(audit_widgets(root)["status"], "incomplete")
            label = QLabel("<b>제목</b>", root)
            label.setGeometry(10, 10, 200, 60)
            label.show()
            self.app.processEvents()
            result = audit_widgets(root)
            self.assertEqual(result["status"], "incomplete", result)
            self.assertTrue(any(check["status"] == "incomplete" and check["id"].startswith("qt.text") for check in result["checks"]))
        finally:
            root.close()

    def test_standard_label_size_hint_does_not_clip_font_leading(self):
        from PySide6.QtGui import QFont
        from PySide6.QtWidgets import QLabel, QWidget
        root = QWidget()
        root.resize(500, 200)
        labels = []
        for index, text in enumerate(("한 줄 상태", "두 줄\n상태")):
            label = QLabel(text, root)
            label.setFont(QFont("Liberation Sans", 12))
            label.adjustSize()
            label.move(10, 10 + 70 * index)
            labels.append(label)
        root.show()
        self.app.processEvents()
        try:
            result = audit_widgets(root)
            self.assertEqual(result["status"], "pass", result)
        finally:
            root.close()


if __name__ == "__main__":
    unittest.main()

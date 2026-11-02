"""한 개의 작업 메모를 편집하고 기존 {note: string} 형식으로 저장한다."""
import json
from pathlib import Path

from PySide6.QtGui import QFont, QKeySequence, QShortcut
from PySide6.QtWidgets import (
    QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget,
)


class NotesWindow(QWidget):
    def __init__(self, state_path):
        super().__init__()
        self.state_path = Path(state_path)
        self._last_saved_note = ""
        self.setWindowTitle("작업 메모")
        self.resize(560, 340)
        self.setMinimumSize(360, 290)
        self.setStyleSheet("""
            QWidget { background: #f6f7fb; color: #182333; }
            QLabel#page-title { color: #15253e; }
            QLabel#page-description, QLabel#shortcut-hint { color: #526176; }
            QLineEdit {
                background: #ffffff; border: 1px solid #8796ab;
                border-radius: 6px; padding: 9px 10px;
                selection-background-color: #204e8a; selection-color: #ffffff;
            }
            QLineEdit:focus { border: 2px solid #204e8a; }
            QPushButton {
                background: #204e8a; color: #ffffff;
                border: 2px solid #204e8a; border-radius: 6px;
                padding: 6px 12px;
            }
            QPushButton:focus { border-color: #0d1728; }
            QPushButton:pressed { background: #173b6c; }
        """)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 22, 24, 22)
        layout.setSpacing(12)

        title = QLabel("작업 메모")
        title.setObjectName("page-title")
        title_font = QFont(self.font())
        title_font.setPointSize(18)
        title_font.setBold(True)
        title.setFont(title_font)
        layout.addWidget(title)

        description = QLabel("기억할 내용을 적고 저장하세요.")
        description.setObjectName("page-description")
        description.setWordWrap(True)
        layout.addWidget(description)
        layout.addSpacing(8)

        label = QLabel("메모")
        label_font = QFont(self.font())
        label_font.setBold(True)
        label.setFont(label_font)
        layout.addWidget(label)

        self.editor = QLineEdit()
        self.editor.setObjectName("note-input")
        self.editor.setAccessibleName("메모")
        self.editor.setPlaceholderText("예: 오후 회의 전 자료 확인")
        self.editor.setMinimumHeight(42)
        label.setBuddy(self.editor)
        layout.addWidget(self.editor)

        shortcut_hint = QLabel("Ctrl+S로도 저장할 수 있습니다.")
        shortcut_hint.setObjectName("shortcut-hint")
        shortcut_hint.setWordWrap(True)
        layout.addWidget(shortcut_hint)
        layout.addStretch(1)

        footer = QHBoxLayout()
        footer.setSpacing(12)
        self.status = QLabel("아직 저장한 메모가 없습니다.")
        self.status.setObjectName("save-status")
        self.status.setWordWrap(True)
        footer.addWidget(self.status, 1)

        self.save_button = QPushButton("메모 저장")
        self.save_button.setObjectName("save-note")
        self.save_button.setMinimumSize(112, 40)
        self.save_button.setToolTip("현재 메모 저장 (Ctrl+S)")
        footer.addWidget(self.save_button)
        layout.addLayout(footer)

        self.save_button.clicked.connect(self.save)
        self.shortcut = QShortcut(QKeySequence("Ctrl+S"), self)
        self.shortcut.activated.connect(self.save)
        self._load_note()
        self.editor.textChanged.connect(self._edited)
        self.setTabOrder(self.editor, self.save_button)
        self.editor.setFocus()

    def _load_note(self):
        if not self.state_path.exists():
            return
        try:
            data = json.loads(self.state_path.read_text(encoding="utf-8"))
            if not isinstance(data, dict) or not isinstance(data.get("note"), str):
                raise ValueError("note는 문자열이어야 한다")
            self._last_saved_note = data["note"]
            self.editor.setText(self._last_saved_note)
            self.status.setText("저장한 메모를 불러왔습니다.")
        except (OSError, UnicodeError, ValueError, TypeError):
            self.status.setText("메모를 불러오지 못했습니다. 저장 파일을 확인하세요.")

    def _edited(self, text):
        if text == self._last_saved_note:
            self.status.setText("저장된 내용과 같습니다." if self.state_path.exists() else "아직 저장한 메모가 없습니다.")
        else:
            self.status.setText("저장하지 않은 변경사항이 있습니다.")

    def save(self):
        try:
            note = self.editor.text()
            self.state_path.write_text(json.dumps({"note": note}, ensure_ascii=False), encoding="utf-8")
        except (OSError, UnicodeError):
            self.status.setText("저장하지 못했습니다. 저장 위치를 확인하고 다시 시도하세요.")
            return
        self._last_saved_note = note
        self.status.setText("저장 완료")

import json
from pathlib import Path
from PySide6.QtGui import QKeySequence,QShortcut
from PySide6.QtWidgets import QWidget,QVBoxLayout,QLabel,QLineEdit,QPushButton

class NotesWindow(QWidget):
    def __init__(self,state_path):
        super().__init__()
        self.state_path=Path(state_path)
        self.setWindowTitle("작업 메모")
        self.setFixedSize(380,190)
        layout=QVBoxLayout(self)
        layout.addWidget(QLabel("메모를 입력하고 저장하세요"))
        self.editor=QLineEdit();self.editor.setObjectName("note-input")
        layout.addWidget(self.editor)
        self.save_button=QPushButton();self.save_button.setObjectName("save-note")
        layout.addWidget(self.save_button)
        self.status=QLabel("저장한 메모는 다음 실행에도 유지됩니다")
        self.status.setFixedSize(120,16)
        layout.addWidget(self.status)
        self.save_button.clicked.connect(self.save)
        self.shortcut=QShortcut(QKeySequence("Ctrl+S"),self)
        self.shortcut.activated.connect(self.save)
        if self.state_path.exists():
            self.editor.setText(json.loads(self.state_path.read_text())["note"])
    def save(self):
        self.state_path.write_text(json.dumps({"note":self.editor.text()},ensure_ascii=False))
        self.status.setText("저장 완료: 다시 실행하면 이 메모를 불러옵니다")

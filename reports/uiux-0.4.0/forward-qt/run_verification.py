"""합성 메모로 실제 Qt 입력·클릭·단축키·새 프로세스 재실행을 확인한다."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import traceback


ROOT = Path(__file__).resolve().parent
ORIGINAL_SHA256 = "72c3a50718a304c96a68f88e8924b0961ef3db7e7d91481a0e1998ac958be019"
sys.dont_write_bytecode = True


def load_window_class(kind):
    module_path = ROOT / ("app.py" if kind == "original" else "app_revised.py")
    spec = importlib.util.spec_from_file_location("forward_notes_" + kind, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.NotesWindow


def dump_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + "\n", encoding="utf-8")


def prepare_environment(run_directory):
    home = run_directory / "home"
    runtime = run_directory / "runtime"
    home.mkdir(parents=True, exist_ok=True)
    runtime.mkdir(parents=True, exist_ok=True, mode=0o700)
    runtime.chmod(0o700)
    os.environ.update(
        HOME=str(home), XDG_RUNTIME_DIR=str(runtime),
        XDG_CONFIG_HOME=str(home / ".config"), XDG_CACHE_HOME=str(home / ".cache"),
        QT_QPA_PLATFORM="offscreen", PYTHONDONTWRITEBYTECODE="1",
    )


def run_reload(kind, state_path, run_directory):
    prepare_environment(run_directory)
    from PySide6.QtWidgets import QApplication
    app = QApplication([])
    window = load_window_class(kind)(state_path)
    window.show()
    app.processEvents()
    print(json.dumps({"note": window.editor.text(), "status": window.status.text()}, ensure_ascii=False))
    window.close()
    return 0


def run_verification(options):
    plugin_root = Path(options.plugin_root).resolve()
    if not (plugin_root / "lib/uiux_qt.py").is_file():
        raise ValueError("--plugin-root에서 lib/uiux_qt.py를 찾을 수 없다")
    if options.out is None:
        run_directory = Path(tempfile.mkdtemp(prefix="replica-forward-qt-"))
    else:
        run_directory = options.out.resolve()
        run_directory.mkdir(parents=True, exist_ok=False)
    prepare_environment(run_directory)
    from PySide6 import __version__ as pyside_version
    from PySide6.QtCore import QCoreApplication, Qt, qVersion
    from PySide6.QtGui import QInputMethodEvent
    from PySide6.QtTest import QTest
    from PySide6.QtWidgets import QApplication, QWidget
    sys.path.insert(0, str(plugin_root))
    from lib.uiux_qt import audit_widgets, snapshot_widgets

    app = QApplication([])
    checks = []
    artifacts = []
    log = []
    windows = []
    summary = {
        "status": "incomplete", "scope": "단일 합성 PySide6 메모 앱의 UI 리비전 독립 실사용 검수",
        "skill": "replica-suite:uiux-workbench", "schema_version": 1,
        "environment": {"platform": sys.platform, "backend": "QWidget", "qpa_platform": QApplication.platformName(),
                        "pyside_version": pyside_version, "qt_version": qVersion()},
        "checks": checks, "artifacts": artifacts,
        "limitations": [
            "미적 품질의 객관적인 우열 또는 모든 Qt 앱에 대한 일반화 근거가 아니다.",
            "Linux offscreen 합성 화면이며 Windows/macOS, 실제 모니터 DPI, 화면 읽기 프로그램은 검증하지 않았다.",
            "단순 QWidget 검사와 실제 QtTest 동작을 구분했다. 픽셀 정확도 점수·사용자 만족도 점수는 측정하지 않았다.",
            "before는 380×190, after 기본 화면은 560×340이며 같은 크기 픽셀 비교로 사용하지 않았다.",
            "저장하지 않은 메모의 닫기 경고, 다중 메모, 동시 파일 수정 충돌은 이 작은 리비전 범위에 포함하지 않았다.",
        ],
    }

    def expect(condition, check_id, observed):
        status = "pass" if condition else "fail"
        checks.append({"id": check_id, "status": status, "observed": observed})
        log.append(f"{status}: {check_id}: {observed}")
        if not condition:
            raise AssertionError(check_id)

    def artifact(path):
        payload = path.read_bytes()
        artifacts.append({"path": str(path.relative_to(run_directory)), "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})

    def public_output(value):
        # 공개 로그는 실행 환경의 절대 경로만 표시를 바꾼다. 판정·개수는 유지한다.
        return value.replace(str(run_directory), "<output>").replace(str(plugin_root), "<plugin>").replace(str(ROOT), "<example>")

    def show(window):
        windows.append(window)
        window.show()
        window.activateWindow()
        window.editor.setFocus()
        QTest.qWait(35)
        app.processEvents()

    def enter(window, text):
        window.editor.setFocus()
        QTest.keyClick(window.editor, Qt.Key.Key_A, Qt.KeyboardModifier.ControlModifier)
        QTest.keyClick(window.editor, Qt.Key.Key_Backspace)
        if text:
            event = QInputMethodEvent()
            event.setCommitString(text)
            QCoreApplication.sendEvent(window.editor, event)
        app.processEvents()
        expect(window.editor.text() == text, f"ime-input-{len(checks)}", window.editor.text())

    def restart(kind, state_path):
        child = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), "--reload", kind, "--state", str(state_path), "--run-directory", str(run_directory)],
            capture_output=True, text=True, timeout=20, env=dict(os.environ),
        )
        expect(child.returncode == 0, f"{kind}-fresh-process-exit-{len(checks)}", child.returncode)
        return json.loads(child.stdout)

    try:
        original_bytes = (ROOT / "app.py").read_bytes()
        expect(hashlib.sha256(original_bytes).hexdigest() == ORIGINAL_SHA256, "original-source-preserved", hashlib.sha256(original_bytes).hexdigest())
        summary["sources"] = {
            "original": {"path": "app.py", "sha256": hashlib.sha256(original_bytes).hexdigest()},
            "revised": {"path": "app_revised.py", "sha256": hashlib.sha256((ROOT / "app_revised.py").read_bytes()).hexdigest()},
        }

        original_state = run_directory / "original-state.json"
        original = load_window_class("original")(original_state)
        show(original)
        before_path = run_directory / "before.png"
        expect(original.grab().save(str(before_path)), "before-png-written", list((original.width(), original.height())))
        artifact(before_path)
        original_audit = audit_widgets(original)
        original_audit_path = run_directory / "before-audit.json"
        dump_json(original_audit_path, original_audit)
        artifact(original_audit_path)
        summary["before_observed_failures"] = [c for c in original_audit["checks"] if c["status"] == "fail"]
        enter(original, "원본 한글 메모: 기능 기준 확인")
        QTest.mouseClick(original.save_button, Qt.MouseButton.LeftButton)
        app.processEvents()
        expect(json.loads(original_state.read_text(encoding="utf-8"))["note"] == original.editor.text(), "original-mouse-save", "기존 note JSON 형식 저장")
        enter(original, "원본 Ctrl+S 저장 확인")
        QTest.keyClick(original.editor, Qt.Key.Key_S, Qt.KeyboardModifier.ControlModifier)
        app.processEvents()
        expect(json.loads(original_state.read_text(encoding="utf-8"))["note"] == original.editor.text(), "original-ctrl-s-save", "기존 단축키 저장")
        expected = original.editor.text()
        original.close()
        expect(restart("original", original_state)["note"] == expected, "original-fresh-process-reload", "새 Python 프로세스에서 같은 메모 로드")

        revised_state = run_directory / "revised-state.json"
        revised = load_window_class("revised")(revised_state)
        show(revised)
        expect(revised.save_button.text() == "메모 저장", "visible-primary-action", revised.save_button.text())
        expect(revised.editor.accessibleName() == "메모", "editor-accessible-name", revised.editor.accessibleName())
        expect("아직 저장" in revised.status.text(), "initial-empty-state", revised.status.text())
        enter(revised, "한글 메모: 오후 회의 전 자료 확인")
        expect("저장하지 않은 변경사항" in revised.status.text(), "dirty-state", revised.status.text())
        QTest.mouseClick(revised.save_button, Qt.MouseButton.LeftButton)
        app.processEvents()
        expect(revised.status.text() == "저장 완료", "mouse-save-feedback", revised.status.text())
        saved = json.loads(revised_state.read_text(encoding="utf-8"))
        expect(saved == {"note": revised.editor.text()}, "mouse-save-compatible-json", saved)
        expect(restart("revised", revised_state)["note"] == revised.editor.text(), "mouse-save-fresh-process-reload", "저장한 한글 메모 재실행 로드")

        revised.activateWindow()
        enter(revised, "Ctrl+S 저장: 재실행 후에도 유지")
        QTest.keyClick(revised.editor, Qt.Key.Key_S, Qt.KeyboardModifier.ControlModifier)
        app.processEvents()
        expect(revised.status.text() == "저장 완료", "ctrl-s-feedback", revised.status.text())
        expect(json.loads(revised_state.read_text(encoding="utf-8"))["note"] == revised.editor.text(), "ctrl-s-json", "키보드 저장 데이터 일치")
        expect(restart("revised", revised_state)["note"] == revised.editor.text(), "ctrl-s-fresh-process-reload", "새 프로세스에서 Ctrl+S 저장 메모 로드")

        revised.activateWindow()
        revised.editor.setFocus()
        QTest.qWait(25)
        QTest.keyClick(revised.editor, Qt.Key.Key_Tab)
        app.processEvents()
        expect(revised.save_button.hasFocus(), "tab-editor-to-save", "편집기→저장 버튼으로 포커스 이동")
        QTest.keyClick(revised.save_button, Qt.Key.Key_Backtab)
        app.processEvents()
        expect(revised.editor.hasFocus(), "shift-tab-save-to-editor", "저장 버튼→편집기로 포커스 복원")

        after_path = run_directory / "after-default.png"
        expect(revised.grab().save(str(after_path)), "after-default-png-written", [revised.width(), revised.height()])
        artifact(after_path)
        default_audit = audit_widgets(revised)
        dump_json(run_directory / "after-default-audit.json", default_audit)
        artifact(run_directory / "after-default-audit.json")
        expect(default_audit["status"] == "pass", "default-widget-audit", default_audit["status"])

        revised.resize(360, 290)
        app.processEvents()
        narrow_audit = audit_widgets(revised)
        dump_json(run_directory / "after-narrow-audit.json", narrow_audit)
        artifact(run_directory / "after-narrow-audit.json")
        narrow_path = run_directory / "after-narrow.png"
        expect(revised.grab().save(str(narrow_path)), "after-narrow-png-written", [revised.width(), revised.height()])
        artifact(narrow_path)
        expect(narrow_audit["status"] == "pass", "narrow-widget-audit", narrow_audit["status"])
        dump_json(run_directory / "snapshot.json", snapshot_widgets(revised))
        artifact(run_directory / "snapshot.json")

        enter(revised, "변경사항 상태와 좁은 창에서 긴 한글 안내 확인")
        dirty_audit = audit_widgets(revised)
        dump_json(run_directory / "after-dirty-narrow-audit.json", dirty_audit)
        artifact(run_directory / "after-dirty-narrow-audit.json")
        expect(dirty_audit["status"] == "pass", "dirty-narrow-widget-audit", dirty_audit["status"])

        loaded = load_window_class("revised")(revised_state)
        show(loaded)
        loaded.resize(360, 290)
        app.processEvents()
        loaded_audit = audit_widgets(loaded)
        dump_json(run_directory / "after-loaded-narrow-audit.json", loaded_audit)
        artifact(run_directory / "after-loaded-narrow-audit.json")
        expect("불러왔습니다" in loaded.status.text(), "loaded-feedback", loaded.status.text())
        expect(loaded_audit["status"] == "pass", "loaded-narrow-widget-audit", loaded_audit["status"])
        loaded.close()
        revised.activateWindow()
        app.processEvents()

        enter(revised, "")
        QTest.mouseClick(revised.save_button, Qt.MouseButton.LeftButton)
        app.processEvents()
        expect(json.loads(revised_state.read_text(encoding="utf-8")) == {"note": ""}, "empty-note-save-preserved", "빈 메모 저장 동작 유지")
        expect(restart("revised", revised_state)["note"] == "", "empty-note-fresh-process-reload", "빈 메모 재실행 로드")

        error_state = run_directory / "write-error.json"
        error_window = load_window_class("revised")(error_state)
        show(error_window)
        error_state.mkdir()
        enter(error_window, "저장 실패 시에도 편집 내용 유지")
        QTest.mouseClick(error_window.save_button, Qt.MouseButton.LeftButton)
        app.processEvents()
        expect("저장하지 못했습니다" in error_window.status.text(), "write-error-feedback", error_window.status.text())
        expect(error_window.editor.text() == "저장 실패 시에도 편집 내용 유지", "write-error-preserves-input", error_window.editor.text())
        error_window.resize(360, 290)
        app.processEvents()
        error_audit = audit_widgets(error_window)
        dump_json(run_directory / "after-write-error-narrow-audit.json", error_audit)
        artifact(run_directory / "after-write-error-narrow-audit.json")
        error_png = run_directory / "after-write-error-narrow.png"
        expect(error_window.grab().save(str(error_png)), "write-error-narrow-png-written", [error_window.width(), error_window.height()])
        artifact(error_png)
        expect(error_audit["status"] == "pass", "write-error-narrow-widget-audit", error_audit["status"])
        error_state.rmdir()
        QTest.mouseClick(error_window.save_button, Qt.MouseButton.LeftButton)
        app.processEvents()
        expect(error_window.status.text() == "저장 완료", "write-error-retry", error_window.status.text())

        snapshot_cli = subprocess.run([
            "node", str(plugin_root / "scripts/uiux.mjs"), "qt", "--snapshot", str(run_directory / "snapshot.json"),
            "--out", str(run_directory / "snapshot-bundle"), "--python", sys.executable,
        ], text=True, capture_output=True, timeout=30, env=dict(os.environ))
        dump_json(run_directory / "snapshot-cli.json", {"exit_code": snapshot_cli.returncode, "stdout": public_output(snapshot_cli.stdout), "stderr": public_output(snapshot_cli.stderr), "paths_redacted": True})
        artifact(run_directory / "snapshot-cli.json")
        expect(snapshot_cli.returncode == 3, "snapshot-cli-honest-incomplete", snapshot_cli.returncode)
        verification = subprocess.run([
            "node", str(plugin_root / "scripts/uiux.mjs"), "verify", "--bundle", str(run_directory / "snapshot-bundle"),
        ], text=True, capture_output=True, timeout=30, env=dict(os.environ))
        dump_json(run_directory / "snapshot-bundle-verification.json", {"exit_code": verification.returncode, "stdout": public_output(verification.stdout), "stderr": public_output(verification.stderr), "paths_redacted": True})
        artifact(run_directory / "snapshot-bundle-verification.json")
        expect(verification.returncode == 0, "snapshot-bundle-integrity", verification.returncode)

        summary["status"] = "pass"
    except Exception as exc:
        summary["status"] = "fail"
        summary["error"] = str(exc)
        log.append(traceback.format_exc())
    finally:
        for window in windows:
            window.close()
        app.processEvents()
        log_path = run_directory / "execution.log"
        log_path.write_text("\n".join(log) + "\n", encoding="utf-8")
        artifact(log_path)
        summary["passed_checks"] = sum(check["status"] == "pass" for check in checks)
        summary["failed_checks"] = sum(check["status"] == "fail" for check in checks)
        summary["run_directory"] = "."
        summary["sources"]["harness"] = {"path": "run_verification.py", "sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
        summary["sources"]["skill"] = {"path": "skills/uiux-workbench/SKILL.md", "base": "plugin", "sha256": hashlib.sha256((plugin_root / "skills/uiux-workbench/SKILL.md").read_bytes()).hexdigest()}
        summary["sources"]["qt_auditor"] = {"path": "lib/uiux_qt.py", "base": "plugin", "sha256": hashlib.sha256((plugin_root / "lib/uiux_qt.py").read_bytes()).hexdigest()}
        summary["harness_corrections"] = "harness-corrections.json (예제 디렉토리 기준)"
        summary["output_policy"] = "기존 결과를 덮어쓰지 않는다. --out은 새 디렉토리여야 하며 기본값은 임시 디렉토리다."
        dump_json(run_directory / "summary.json", summary)
        print(json.dumps({"status": summary["status"], "passed_checks": summary["passed_checks"], "failed_checks": summary["failed_checks"], "output": str(run_directory)}, ensure_ascii=False))
    return 0 if summary["status"] == "pass" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="합성 Qt 메모 앱의 실제 UI 리비전 재현 검사. 새 --out 경로나 기본 임시 디렉토리에만 결과를 쓴다.")
    parser.add_argument("--out", type=Path, help="존재하지 않는 새 출력 디렉토리. 생략하면 임시 디렉토리")
    parser.add_argument("--plugin-root", default=os.environ.get("REPLICA_SUITE_ROOT", str(ROOT.parents[2])), help="replica-suite 루트. 기본값은 이 예제가 속한 저장소")
    parser.add_argument("--reload", choices=("original", "revised"))
    parser.add_argument("--state", type=Path)
    parser.add_argument("--run-directory", type=Path)
    options = parser.parse_args()
    if options.reload:
        if options.state is None or options.run_directory is None:
            parser.error("재실행 내부 검사에는 --state와 --run-directory가 필요하다")
        if not options.state.resolve().is_relative_to(options.run_directory.resolve()):
            parser.error("재실행 검사는 이번 출력 디렉토리의 합성 데이터만 읽는다")
        raise SystemExit(run_reload(options.reload, options.state, options.run_directory))
    raise SystemExit(run_verification(options))

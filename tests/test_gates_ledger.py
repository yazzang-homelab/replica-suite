import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILLS = Path(__file__).resolve().parents[1] / "skills"
QA = SKILLS / "web-qa-independent/scripts/qa_gate.py"
LEDGER = SKILLS / "native-trace/scripts/trace_ledger.py"

VP = {"pageErrors": [], "consoleErrors": [], "httpErrors": [], "badImages": [],
      "horizontalOverflow": False, "scrollHeight": 100, "canvases": []}
GOOD = {"name": "home", "missing": False, "sizeMismatch": False, "changedRatio": 0.0,
        "worstBands": [], "maxChannelDelta": 0}


def run(*args):
    return subprocess.run([sys.executable, *map(str, args)], capture_output=True, text=True)


class QaGate(unittest.TestCase):
    def gate(self, diff, replica, ref=None, extra=()):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            (t / "d.json").write_text(json.dumps(diff) if not isinstance(diff, str) else diff)
            (t / "r.json").write_text(json.dumps(replica))
            args = [QA, "--diff", t / "d.json", "--replica", t / "r.json", *extra]
            if ref is not None:
                (t / "f.json").write_text(json.dumps(ref))
                args += ["--ref", t / "f.json"]
            return run(*args)

    def test_good_passes(self):
        p = self.gate([GOOD], {"viewports": {"d": VP}}, {"viewports": {"d": VP}})
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)

    def test_empty_inputs_block(self):
        for diff, rep in (([], {"viewports": {"d": VP}}), ([GOOD], {"viewports": {}}),
                          ([GOOD], {}), ({}, {"viewports": {"d": VP}}), ("not json", {"viewports": {"d": VP}})):
            p = self.gate(diff, rep)
            self.assertEqual(p.returncode, 2, (diff, rep, p.stdout))
            self.assertIn("BLOCK", p.stdout)

    def test_nonfinite_ratio_blocks(self):
        bad = dict(GOOD, changedRatio=float("nan"))
        self.assertEqual(self.gate([bad], {"viewports": {"d": VP}}).returncode, 2)
        bad = dict(GOOD, changedRatio="0")
        self.assertEqual(self.gate([bad], {"viewports": {"d": VP}}).returncode, 2)

    def test_failing_ratio_blocks(self):
        bad = dict(GOOD, changedRatio=0.5, worstBands=[[0, 1]])
        self.assertEqual(self.gate([bad], {"viewports": {"d": VP}}).returncode, 2)

    def test_missing_viewport_vs_ref_blocks(self):
        p = self.gate([GOOD], {"viewports": {"d": VP}}, {"viewports": {"d": VP, "m": VP}})
        self.assertEqual(p.returncode, 2)
        p = self.gate([GOOD], {"viewports": {"d": VP, "x": VP}}, {"viewports": {"d": VP}})
        self.assertEqual(p.returncode, 2)

    def test_malformed_viewport_blocks(self):
        p = self.gate([GOOD], {"viewports": {"d": {"pageErrors": []}}})
        self.assertEqual(p.returncode, 2)
        self.assertNotIn("Traceback", p.stderr)


class Ledger(unittest.TestCase):
    def setUp(self):
        self._t = tempfile.TemporaryDirectory()
        self.addCleanup(self._t.cleanup)
        self.t = Path(self._t.name)
        for n, c in (("a", "1"), ("b", "2"), ("a2", "3"), ("b2", "4")):
            (self.t / n).write_text(c)
        self.d = self.t / "led"

    def L(self, *args):
        return run(LEDGER, *args)

    def p(self, n):
        return str(self.t / n)

    def init(self):
        r = self.L("init", self.d, "--objective", "o", "--artifact", self.p("a"), "--artifact", self.p("b"))
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_multi_artifact_advance_and_stale_propagation(self):
        self.init()
        r = self.L("add", self.d, "--kind", "observed", "--text", "x", "--loc", "m+1")
        self.assertEqual(r.stdout.split()[0], "E1", r.stderr)
        r = self.L("add", self.d, "--kind", "derived", "--text", "y", "--dep", "E1")
        self.assertEqual(r.returncode, 0, r.stderr)
        r = self.L("advance", self.d, "--artifact", f"{self.p('a')}={self.p('a2')}",
                   "--artifact", f"{self.p('b')}={self.p('b2')}")
        self.assertEqual(r.returncode, 0, r.stderr)
        out = self.L("show", self.d).stdout
        self.assertIn("E1 [observed STALE]", out)
        self.assertIn("E2 [derived STALE]", out)
        r = self.L("add", self.d, "--kind", "derived", "--text", "z", "--dep", "E1")
        self.assertNotEqual(r.returncode, 0)

    def test_drift_marks_multi_artifact_claims(self):
        self.init()
        self.L("add", self.d, "--kind", "observed", "--text", "x", "--loc", "m+1")
        self.L("add", self.d, "--kind", "derived", "--text", "y", "--dep", "E1")
        (self.t / "b").write_text("changed")
        r = self.L("check", self.d)
        self.assertEqual(r.returncode, 1)
        self.assertIn("E1", r.stdout)
        out = self.L("show", self.d).stdout
        self.assertIn("E2 [derived STALE]", out)

    def test_new_claim_refused_when_artifact_drifted(self):
        self.init()
        (self.t / "a").write_text("changed")
        r = self.L("add", self.d, "--kind", "observed", "--text", "x", "--loc", "m+1")
        self.assertNotEqual(r.returncode, 0)

    def test_advance_validation_does_not_append(self):
        self.init()
        ledger = self.d / "ledger.jsonl"
        before = ledger.read_text()
        for spec in (f"{self.p('zzz')}={self.p('a2')}", f"{self.p('a')}={self.p('a')}",
                     f"{self.p('a')}={self.p('nope')}", "noequals", f"{self.p('a')}={self.p('b')}"):
            r = self.L("advance", self.d, "--artifact", spec)
            self.assertNotEqual(r.returncode, 0, spec)
            self.assertNotIn("Traceback", r.stderr)
        self.assertEqual(ledger.read_text(), before)


if __name__ == "__main__":
    unittest.main()

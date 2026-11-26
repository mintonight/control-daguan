"""CLI and reporting tests without a browser or server."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('verify_all', ROOT / 'tools/verify_all.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)

    def run_fake(self, names, execute):
        with contextlib.redirect_stdout(io.StringIO()):
            return runner.run_suites('http://localhost:8765/', names, self.directory, execute)

    def test_tools_parse_and_feature_map_commands_name_real_suites(self):
        import ast
        import re
        for source in (ROOT / 'tools').glob('*.py'):
            ast.parse(source.read_text(encoding='utf-8'), filename=str(source))
        documented = set(re.findall(r'python3 tools/verify_all.py http://localhost:8765/ --only (\w+)', (ROOT / 'FEATURES.md').read_text(encoding='utf-8')))
        self.assertEqual(documented, set(runner.SUITES))
        self.assertFalse(list((ROOT / 'tools').glob('shot*.py')))

    def test_only_runs_selected_suite_and_writes_log(self):
        called = []
        def execute(script, url):
            called.append((script, url))
            return 0, '2/2 passed\n'
        results = self.run_fake(['notes'], execute)
        self.assertEqual(called, [('verify_notes.py', 'http://localhost:8765/')])
        self.assertEqual(results[0]['status'], 'passed')
        self.assertEqual((self.directory / 'notes.log').read_text(), '2/2 passed\n')

    def test_failures_continue_to_remaining_suites_and_do_not_trust_exit_zero(self):
        codes = iter([(1, 'Traceback: broken\n'), (0, 'no summary\n'), (0, '1/2 passed\n'), (0, '2/2 passed\n')])
        results = self.run_fake(['main', 'fsrs', 'sync', 'notes'], lambda *args: next(codes))
        self.assertEqual([r['status'] for r in results], ['failed', 'failed', 'failed', 'passed'])

    def test_timeout_and_spawn_failure_are_reported_and_continue(self):
        def execute(script, url):
            if script == 'verify.py':
                raise subprocess.TimeoutExpired('suite', 300, output=b'partial progress')
            if script == 'verify_fsrs.py':
                raise OSError('cannot launch')
            return 0, '1/1 passed\n'
        results = self.run_fake(['main', 'fsrs', 'sync'], execute)
        self.assertEqual([r['status'] for r in results], ['failed', 'failed', 'passed'])
        self.assertIn('partial progress', (self.directory / 'main.log').read_text())
        self.assertIn('cannot launch', (self.directory / 'fsrs.log').read_text())

    def test_interrupt_remains_an_interrupt_if_child_exits_during_cleanup(self):
        with patch.object(runner.subprocess, 'Popen') as popen, patch.object(runner.os, 'killpg', side_effect=ProcessLookupError(), create=True):
            process = popen.return_value.__enter__.return_value
            process.communicate.side_effect = [KeyboardInterrupt(), ('', None)]
            with self.assertRaises(KeyboardInterrupt):
                runner.execute('verify.py', 'http://localhost:8765/')

    def test_interrupt_skips_remaining_work(self):
        def execute(*args):
            raise KeyboardInterrupt()
        results = self.run_fake(['main', 'fsrs', 'sync'], execute)
        self.assertEqual([r['status'] for r in results], ['interrupted', 'skipped', 'skipped'])

    def test_unknown_suite_and_unsafe_url_exit_two_without_launching_browser(self):
        for args in [['http://localhost:8765/', '--only', 'unknown'], ['https://user:pass@example.com/'], ['file:///tmp/site']]:
            with self.subTest(args=args):
                result = subprocess.run([sys.executable, str(ROOT / 'tools/verify_all.py'), *args], capture_output=True, text=True)
                self.assertEqual(result.returncode, 2)
                self.assertIn('error:', result.stderr)
                self.assertNotIn('RUN ', result.stdout)

    def test_snapshot_failure_and_interrupt_have_machine_readable_exit_reports(self):
        for error, expected in [(RuntimeError('capture failed'), 1), (KeyboardInterrupt(), 130)]:
            async def capture(*args):
                raise error
            directory = self.directory / 'shots/verification'
            directory.mkdir(parents=True, exist_ok=True)
            with patch.object(runner, 'ROOT', self.directory), patch.object(runner, 'run_suites', return_value=[{'suite': 'settings', 'status': 'passed'}]), patch.dict(sys.modules, {'snapshots': types.SimpleNamespace(capture=capture)}), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                code = runner.main(['http://localhost:8765/', '--only', 'settings', '--shots'])
            self.assertEqual(code, expected)
            report = json.loads((directory / 'report.json').read_text())
            self.assertEqual(report['exit_code'], expected)
            self.assertEqual(report['snapshots']['status'], 'failed' if expected == 1 else 'interrupted')


if __name__ == '__main__':
    unittest.main(verbosity=2)

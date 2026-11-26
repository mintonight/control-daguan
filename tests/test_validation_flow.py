import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import tempfile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from change_scope import SUITES
from validate_changes import browser_policy, commands


class ValidationFlowTest(unittest.TestCase):
    def test_content_never_automatically_runs_six_browser_suites(self):
        for mode in ('content', 'docs'):
            plan={'mode':mode,'suites':[]}
            self.assertEqual(browser_policy(plan),[])
            self.assertEqual(browser_policy(plan,ci=True),[])
            self.assertEqual(browser_policy(plan,full=True),SUITES)

    def test_runtime_and_full_are_ci_owned_not_repeated_by_local_preflight(self):
        for suites in [['main','sync','settings'],SUITES]:
            plan={'suites':suites}
            self.assertEqual(browser_policy(plan),[])
            self.assertEqual(browser_policy(plan,ci=True),suites)

    def test_universal_node_math_guards_and_python_regressions_remain(self):
        cmds=commands()
        self.assertEqual(cmds[0],['npm','test'])
        self.assertIn(['-m','unittest','discover','-s','tests','-p','test_*.py'],[c[1:] for c in cmds])
        self.assertEqual(len(cmds),2)
        self.assertEqual(json.loads((ROOT/'package.json').read_text())['scripts']['test'],'node --test "tests/**/*.test.mjs"')
        for file,signal in [('lint-rules.test.mjs',"lintFiles(['.'])"),('type-contracts.test.mjs',"run('tsconfig.json')"),('wait-policy.test.mjs',"['tools/check_waits.py']")]:
            self.assertIn(signal,(ROOT/'tests'/file).read_text())

    def test_changed_unified_guard_contract_falls_back_to_explicit_guards(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'package.json').write_text(json.dumps({'scripts':{'test':'node --test'}}))
            with patch('validate_changes.ROOT',root):
                for guard in ['lint','types','check:waits']:
                    self.assertIn(['npm','run',guard],commands())

    def test_ci_uses_shared_entry_full_history_and_one_build_artifact(self):
        workflow=(ROOT/'.github/workflows/pages.yml').read_text(encoding='utf-8')
        self.assertIn('python3 tools/validate_changes.py --ci',workflow)
        self.assertIn('fetch-depth: 0',workflow)
        self.assertIn('pull_request:',workflow)
        self.assertIn('cache: pip',workflow)
        self.assertIn('requirements-ci.txt',workflow)
        self.assertEqual(workflow.count('actions/checkout@'),1)
        self.assertNotIn('tools/build_precache.py',workflow)
        self.assertIn('actions/upload-pages-artifact@v3',workflow)
        self.assertIn('needs: test',workflow)
        self.assertIn('cancel-in-progress: false',workflow)


if __name__=='__main__':unittest.main()

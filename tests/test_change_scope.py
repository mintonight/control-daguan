import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'tools'))
from change_scope import classify, git_changes, event_base


def source(answer='old', shared=False):
    questions=[{'no':5,'answer':answer,'explanation':'','figures':['img/q2023-5-1.png'],'answerImages':[]}]
    if shared: questions.append({'no':6,'figures':['img/q2023-5-1.png']})
    return json.dumps({'year':2023,'questions':questions})


class ChangeScopeTest(unittest.TestCase):
    def plan(self, paths, old=None, new=None, known=True):
        before={'data-src/2023/questions.json':source(), 'public/sw.js':'const PRECACHE = {"v":1};\nlogic();'}
        after={'data-src/2023/questions.json':source('new'), 'public/sw.js':'const PRECACHE = {"v":2};\nlogic();'}
        for path in paths:after.setdefault(path, 'fixture')
        before.update(old or {});after.update(new or {})
        return classify(paths,before.get,after.get,known)

    def test_question_and_generated_detail_are_content(self):
        p=self.plan(['data-src/2023/questions.json','public/data/questions/202305.json','public/data/library.json'])
        self.assertEqual(p['mode'],'content');self.assertEqual(p['question_ids'],[202305]);self.assertEqual(p['suites'],[])

    def test_only_generated_or_unrelated_generated_falls_back_full(self):
        for paths in [['public/data/questions/202305.json'],['data-src/2023/questions.json','public/data/questions/202306.json']]:
            self.assertEqual(self.plan(paths)['mode'],'full')

    def test_unknown_generated_files_still_force_full_with_valid_content(self):
        for path in ['public/data/unknown.bin','public/img/nested/q2023-5-1.png']:
            self.assertEqual(self.plan(['data-src/2023/questions.json',path])['mode'],'full')
        self.assertEqual(self.plan(['tests/q202305.test.mjs'],new={'tests/q202305.test.mjs':None})['mode'],'full')

    def test_local_canonical_image_and_its_copy_are_content(self):
        p=self.plan(['data-src/2023/img/q2023-5-1.png','public/img/q2023-5-1.png'],new={'data-src/2023/img/q2023-5-1.png':'pixels'})
        self.assertEqual(p['mode'],'content');self.assertEqual(p['question_ids'],[202305])

    def test_shared_or_unreferenced_images_are_full(self):
        for update in [{'data-src/2023/questions.json':source(shared=True),'data-src/2023/img/q2023-5-1.png':'x'}, {'data-src/2023/img/q2023-5-2.png':'x'}]:
            name=next(k for k in update if '/img/' in k)
            self.assertEqual(self.plan([name],new=update)['mode'],'full')
        self.assertEqual(self.plan(['public/icons/icon-192.png'])['mode'],'full')

    def test_question_math_tests_allowed_but_unknown_shared_tests_are_full(self):
        self.assertEqual(self.plan(['tests/q202305.test.mjs'])['mode'],'content')
        self.assertEqual(self.plan(['data-src/2023/questions.json','tests/recent4-corrections.test.mjs'])['mode'],'content')
        for path in ['tests/recent4-corrections.test.mjs','tests/helpers/sync-machine.mjs','tests/test_change_scope.py']:
            self.assertEqual(self.plan([path])['mode'],'full')

    def test_isolated_runtime_uses_related_suites_and_generated_sw_is_neutral(self):
        p=self.plan(['public/src/sync/gist.js','public/sw.js'])
        self.assertEqual(p['mode'],'runtime');self.assertEqual(set(p['suites']),{'main','sync','settings'})
        self.assertEqual(self.plan(['public/src/srs/fsrs.js'])['mode'],'runtime')
        self.assertEqual(self.plan(['public/src/ui/notes-editor.js'])['mode'],'runtime')

    def test_shared_renderer_schema_storage_sw_logic_and_unknown_are_full(self):
        paths=['public/src/ui/markdown.js','public/src/ui/view.js','public/src/store/kv.js','public/src/core/types.js','public/app.css','tools/build_data.py','.github/workflows/pages.yml','unexpected.txt','public/data/unknown.bin','public/img/nested/q2023-5-1.png']
        for path in paths:self.assertEqual(self.plan([path])['mode'],'full',path)
        self.assertEqual(self.plan(['public/sw.js'],new={'public/sw.js':'const PRECACHE = {};\nnewLogic();'})['mode'],'full')

    def test_unknown_base_empty_diff_deletions_or_malformed_source_are_full(self):
        self.assertEqual(self.plan(['data-src/2023/questions.json'],known=False)['mode'],'full')
        self.assertEqual(self.plan([])['mode'],'full')
        for value in [None,'bad json',json.dumps({'questions':[]})]:
            self.assertEqual(self.plan(['data-src/2023/questions.json'],new={'data-src/2023/questions.json':value})['mode'],'full')

    def test_question_plot_code_is_content_only_with_its_content_change(self):
        self.assertEqual(self.plan(['tools/plot_q202305.py'])['mode'],'full')
        self.assertEqual(self.plan(['data-src/2023/questions.json','tools/plot_q202305.py'])['mode'],'content')

    def test_mixed_runtime_content_uses_runtime_and_keeps_question_ids(self):
        p=self.plan(['data-src/2023/questions.json','public/src/sync/gist.js'])
        self.assertEqual(p['mode'],'runtime');self.assertEqual(p['question_ids'],[202305])

    def test_multicommit_push_pr_mergebase_and_worktree_are_not_head_parent_only(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
            git('init','-q');git('config','user.name','Scope test');git('config','user.email','test@example.invalid')
            (root/'one').write_text('1');git('add','.');git('commit','-qm','base');base=git('rev-parse','HEAD')
            (root/'one').write_text('2');git('commit','-qam','first');(root/'two').write_text('3');git('add','.');git('commit','-qm','second')
            paths,known=git_changes(root,base);self.assertTrue(known);self.assertEqual(set(paths),{'one','two'})
            git('branch','scope-feature');git('checkout','-qb','scope-target',base)
            (root/'target-only').write_text('target');git('add','.');git('commit','-qm','target advances');target=git('rev-parse','HEAD')
            git('checkout','-q','scope-feature')
            self.assertEqual(event_base(root,'pull_request',{'pull_request':{'base':{'sha':target}}}),base)
            (root/'three').write_text('untracked');paths,_=git_changes(root,base);self.assertIn('three',paths)
            self.assertEqual(event_base(root,'push',{'before':base}),base)
            self.assertEqual(event_base(root,'pull_request',{'pull_request':{'base':{'sha':base}}}),base)
            self.assertIsNone(event_base(root,'push',{'before':'0'*40}))
            self.assertIsNone(event_base(root,'workflow_dispatch',{}))
            self.assertIsNone(event_base(root,'pull_request',{'pull_request':None}))
            self.assertFalse(git_changes(root,'missing-ref')[1])
            # A renamed/deleted old path cannot disappear from classification.
            git('mv','one','renamed');paths,_=git_changes(root,base);self.assertIn('one',paths);self.assertIn('renamed',paths)


if __name__=='__main__':unittest.main()

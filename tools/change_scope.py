"""Conservative validation scope shared by the local preflight and Actions."""
import json
from pathlib import Path
import re
import subprocess

SUITES = ['main', 'fsrs', 'sync', 'notes', 'settings', 'pwa']
RUNTIME = {
    'public/src/sync/gist.js': ['main', 'sync', 'settings'],
    'public/src/srs/fsrs.js': ['main', 'fsrs', 'sync'],
    'public/src/ui/notes-editor.js': ['main', 'notes', 'sync'],
}
MATH_TESTS = {'exam-standard-solutions.test.mjs', 'exam-style-priority.test.mjs',
              'exam-style-remaining.test.mjs', 'featured-corrections.test.mjs',
              'recent4-corrections.test.mjs', 'severe-final-two.test.mjs',
              'severe-solvable-old.test.mjs', 'standalone-final.test.mjs',
              'standalone-older.test.mjs', 'standalone-recent.test.mjs'}
GENERIC_PLOT_TOOLS = {'tools/plot_solutions.py', 'tools/redraw_freq_figs.py', 'tools/exam_plot.py'}
DOC_FILE = re.compile(r'^(?!public/).+\.md$')
PRECACHE = re.compile(r'const PRECACHE = \{.*?\};', re.S)


def records(text):
    source = json.loads(text)
    rows = source['questions']
    result = {q['no']: q for q in rows}
    if not result or len(result) != len(rows):
        raise ValueError('missing or duplicate questions')
    return source, result


def asset_ids(path, read):
    match = re.fullmatch(r'data-src/(\d{4})/(img/[^/]+)', path)
    if not match:
        return []
    year, image = match.groups()
    _, rows = records(read(f'data-src/{year}/questions.json'))
    return [int(year)*100+no for no, q in rows.items()
            if image in q.get('figures', [])+q.get('answerImages', [])
            or any(f']({image})' in q.get(field, '') for field in ['answer', 'explanation'])]


def classify(paths, before, after, base_known=True):
    ids, runtime, reasons, generated, source_images, public_images = set(), set(), [], set(), set(), set()
    broad_tests, metadata, plot_tools, generic_plot_tools, docs = [], [], [], [], []
    paths = sorted(set(paths))
    if not base_known:
        reasons.append('unknown git baseline')
    for path in paths:
        try:
            if after(path) is None:
                raise ValueError('deleted path')
            match = re.fullmatch(r'data-src/(\d{4})/questions.json', path)
            if match:
                old, old_rows = records(before(path)); new, new_rows = records(after(path))
                if old_rows.keys() != new_rows.keys():
                    raise ValueError('added/deleted question')
                changed = {no for no in new_rows if old_rows[no] != new_rows[no]}
                if not changed or {k:v for k,v in old.items() if k!='questions'} != {k:v for k,v in new.items() if k!='questions'}:
                    changed = set(new_rows)
                ids.update(int(match[1])*100+no for no in changed)
            elif path.startswith('data-src/') and '/img/' in path:
                affected = asset_ids(path, after)
                if after(path) is None or len(affected) != 1:
                    raise ValueError('deleted, shared or unreferenced question image')
                ids.update(affected);source_images.add(Path(path).name)
            elif re.fullmatch(r'public/data/questions/\d{6}\.json', path):
                generated.add(int(Path(path).stem))
            elif path == 'public/data/library.json':
                metadata.append(path)
            elif re.fullmatch(r'public/img/[^/]+', path):
                public_images.add(Path(path).name)
            elif re.fullmatch(r'tests/q\d{6}\.test\.mjs', path) or re.fullmatch(r'tests/test_q\d{6}_plot\.py', path):
                qid = int(re.search(r'q(\d{6})', path)[1])
                _, rows = records(after(f'data-src/{qid//100}/questions.json'))
                if qid % 100 not in rows or after(path) is None:
                    raise ValueError('unknown/deleted question test')
                ids.add(qid)
            elif path == 'tests/'+Path(path).name and Path(path).name in MATH_TESTS:
                broad_tests.append(path)
            elif re.fullmatch(r'tools/plot_q\d{6}(?:_[a-z0-9]+)?\.py', path):
                plot_tools.append(int(re.search(r'q(\d{6})',path)[1]))
            elif path in GENERIC_PLOT_TOOLS:
                generic_plot_tools.append(path)
            elif DOC_FILE.fullmatch(path):
                docs.append(path)
            elif path in RUNTIME:
                runtime.update(RUNTIME[path])
            elif path == 'public/sw.js':
                old, new = before(path), after(path)
                if not old or not new or len(PRECACHE.findall(old))!=1 or len(PRECACHE.findall(new))!=1 or PRECACHE.sub('',old)!=PRECACHE.sub('',new):
                    raise ValueError('service worker logic changed')
                for value in [old,new]:
                    json.loads(PRECACHE.search(value)[0][len('const PRECACHE = '):-1])
            else:
                reasons.append(f'shared/unknown boundary: {path}')
        except (ValueError, TypeError, KeyError, AttributeError) as error:
            reasons.append(f'{path}: {error}')
    if set(plot_tools) - ids or (generic_plot_tools and not ids):
        reasons.append('plotting code without identified content change')
    if generated - ids:
        reasons.append('generated question without corresponding source/test/image')
    if public_images - source_images:
        reasons.append('generated/shared image without canonical change')
    if (metadata or broad_tests) and not ids:
        reasons.append('shared metadata/math tests without identified questions')
    if not ids and not runtime and not docs:
        reasons.append('no classified content or isolated runtime change')
    mode = 'full' if reasons else 'runtime' if runtime else 'content' if ids else 'docs'
    return {'mode':mode, 'question_ids':sorted(ids), 'suites':SUITES if mode=='full' else [s for s in SUITES if s in runtime],
            'reasons':reasons, 'paths':paths, 'base_known':base_known}


def git(root, *args):
    return subprocess.check_output(['git',*args],cwd=root,stderr=subprocess.DEVNULL)


def commit(root, ref):
    return git(root,'rev-parse','--verify','--end-of-options',ref+'^{commit}').decode().strip()


def git_changes(root, base):
    try:
        base = commit(root, base)
        paths = git(root,'diff','--name-only','--no-renames','-z',base,'--').decode().split('\0')
        paths += git(root,'ls-files','--others','--exclude-standard','-z').decode().split('\0')
        return sorted(set(filter(None,paths))), True
    except (subprocess.CalledProcessError, TypeError):
        return [], False


def event_base(root, name, event):
    try:
        if name == 'push':
            ref = event['before']
            return commit(root, ref) if ref and set(ref)!={'0'} else None
        if name == 'pull_request':
            base = commit(root, event['pull_request']['base']['sha'])
            return git(root,'merge-base',base,'HEAD').decode().strip()
    except (KeyError, TypeError, subprocess.CalledProcessError):
        pass
    return None


def current_plan(root, base):
    paths, known = git_changes(root, base)
    def before(path):
        try:return git(root,'show',f'{commit(root,base)}:{path}').decode(errors='replace')
        except subprocess.CalledProcessError:return None
    def after(path):
        p = Path(root)/path
        return p.read_text(encoding='utf-8', errors='replace') if p.is_file() else None
    result = classify(paths,before,after,known)
    result['base'] = base
    return result

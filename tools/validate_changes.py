#!/usr/bin/env python3
"""Shared risk-based preflight/CI entry. Local preflight leaves costly runtime suites to CI."""
import argparse
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

from change_scope import current_plan, event_base, SUITES
from verify_all import main as full_browser, run_suites, site_url

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'shots/validation'
GUARD_TESTS = ['lint-rules.test.mjs','type-contracts.test.mjs','wait-policy.test.mjs']


def commands():
    # npm test already runs repository-wide ESLint, positive/negative tsc and the wait-policy scanner.
    package = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
    guards = all((ROOT/'tests'/name).is_file() for name in GUARD_TESTS)
    result = [['npm','test'],[sys.executable,'-m','unittest','discover','-s','tests','-p','test_*.py']]
    if not guards or package['scripts']['test'] != 'node --test "tests/**/*.test.mjs"':
        result += [['npm','run',name] for name in ['lint','types','check:waits']]
    return result


def browser_policy(plan, ci=False, full=False):
    return SUITES if full else plan['suites'] if ci else []


@contextmanager
def server():
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    httpd = ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT/'public')))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{httpd.server_port}/'
    finally:
        httpd.shutdown();httpd.server_close();thread.join()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', help='whole push/branch baseline, not implicitly HEAD~1')
    parser.add_argument('--ci', action='store_true', help='run required browser suites; resolve actual push/PR event baseline')
    parser.add_argument('--full', action='store_true', help='explicit complete local audit, even for content')
    parser.add_argument('--plan', action='store_true', help='inspect classification only; NOT a validation pass')
    parser.add_argument('--live', type=site_url, help='only verify deployed bytes and targeted rendering after green CI')
    args = parser.parse_args(argv)
    base = args.base
    if base is None:
        if args.ci:
            event_path = os.environ.get('GITHUB_EVENT_PATH')
            event = json.loads(Path(event_path).read_text(encoding='utf-8')) if event_path else {}
            base = event_base(ROOT,os.environ.get('GITHUB_EVENT_NAME'),event)
        else:
            base = 'HEAD'
    plan = current_plan(ROOT,base)
    if args.full:
        plan.update(mode='full',suites=SUITES)
    print(json.dumps(plan,ensure_ascii=False,indent=2),flush=True)
    if args.plan:
        return 0
    OUT.mkdir(parents=True,exist_ok=True)
    report = {'scope':plan,'steps':[],'completed':False,'validation_level':'live' if args.live else 'required' if args.ci or args.full else 'local_preflight', 'complete_required_validation':False}
    def step(name, action):
        start = time.monotonic()
        print('CHECK '+name,flush=True)
        try:
            return action()
        finally:
            report['steps'].append({'name':name,'seconds':round(time.monotonic()-start,3)})
    def run(command):
        subprocess.run(command,cwd=ROOT,check=True)
    ids = plan['question_ids'] or [202301,202304]
    try:
        from verify_content import verify
        if args.live:
            step('deployed bytes and targeted desktop/mobile',lambda:verify(args.live,ids,OUT/'live',plan['paths']))
        else:
            step('canonical data/schema/assets build',lambda:run([sys.executable,'tools/build_data.py']))
            step('precache build',lambda:run([sys.executable,'tools/build_precache.py']))
            drift = subprocess.check_output(['git','status','--porcelain','--','public'],cwd=ROOT,text=True)
            report['generated_changes'] = drift.splitlines()
            if args.ci and drift:
                raise RuntimeError('committed public/ differs from fresh canonical build:\n'+drift)
            if drift and not args.ci:
                print('Generated outputs refreshed; review/stage them before pushing:\n'+drift,flush=True)
            for command in commands():
                step(' '.join(command),lambda c=command:run(c))
            run(['git','diff','--check'])
            required = browser_policy(plan,args.ci,args.full)
            if required or plan['mode'] != 'docs':
                with server() as url:
                    if required==SUITES:
                        def all_suites():
                            if full_browser([url,'--shots']):
                                raise RuntimeError('full browser verification failed')
                        step('six browser suites and snapshots',all_suites)
                    elif required:
                        def selected():
                            results=run_suites(url,required,OUT/'browser')
                            report['browser_suites']=results
                            if not all(row['status']=='passed' for row in results):
                                raise RuntimeError('selected browser verification failed')
                        step('selected browser suites',selected)
                    # Only changed/representative questions, never full-library snapshots on content.
                    step('targeted desktop/mobile text, original images and KaTeX',lambda:verify(url,ids,OUT/'content'))
            report['deferred_to_ci'] = plan['suites'] if not args.ci and not args.full else []
            if report['deferred_to_ci']:
                print('LOCAL PREFLIGHT ONLY: CI must still pass '+','.join(report['deferred_to_ci']),flush=True)
        report['complete_required_validation'] = not args.live and (args.ci or args.full or not plan['suites'])
        report['completed'] = True
        return 0
    except Exception as error:
        report['error'] = str(error)
        print(str(error),file=sys.stderr)
        return 1
    finally:
        (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    sys.exit(main())

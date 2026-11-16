"""One entry for six isolated browser suites and optional deterministic example snapshots."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SUITES = {'main': 'verify.py', 'fsrs': 'verify_fsrs.py', 'sync': 'verify_sync.py',
          'notes': 'verify_notes.py', 'settings': 'verify_settings.py', 'pwa': 'verify_pwa.py'}


def site_url(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError('URL must be an http(s) site root without credentials, query, or fragment')
    return value.rstrip('/') + '/'


def execute(script, url):
    command = [sys.executable, '-u', str(ROOT / 'tools' / script), url]
    with subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, start_new_session=True) as process:
        try:
            output, _ = process.communicate(timeout=300)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.communicate()
            raise
        return process.returncode, output


def run_suites(url, names, directory, run=execute):
    directory.mkdir(parents=True, exist_ok=True)
    results = []
    for name in names:
        print(f'RUN {name}', flush=True)
        interrupted = False
        try:
            code, output = run(SUITES[name], url)
            counts = re.findall(r'(\d+)/(\d+) passed', output)
            passed, total = map(int, counts[-1]) if counts else (0, 0)
            success = code == 0 and total > 0 and passed == total
            result = {'suite': name, 'status': 'passed' if success else 'failed',
                      'exit_code': code, 'passed': passed, 'total': total}
        except KeyboardInterrupt:
            output = 'Interrupted by keyboard\n'
            result = {'suite': name, 'status': 'interrupted', 'exit_code': 130}
            interrupted = True
        except Exception as error:
            output = f'{type(error).__name__}: {error}\n'
            if isinstance(error, subprocess.TimeoutExpired) and error.output:
                output += error.output.decode(errors='replace') if isinstance(error.output, bytes) else error.output
            result = {'suite': name, 'status': 'failed', 'exit_code': 1}
        log = directory / f'{name}.log'
        log.write_text(output, encoding='utf-8')
        result['log'] = str(log)
        print(output, end='' if output.endswith('\n') else '\n', flush=True)
        print(f"RESULT {name}: {result['status']}", flush=True)
        results.append(result)
        if interrupted:
            results.extend({'suite': later, 'status': 'skipped'} for later in names[len(results):])
            break
    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url', type=site_url)
    parser.add_argument('--only', choices=SUITES)
    parser.add_argument('--shots', action='store_true', help='capture local example fixtures in light/dark desktop/mobile')
    args = parser.parse_args(argv)
    directory = ROOT / 'shots' / 'verification'
    results = run_suites(args.url, [args.only] if args.only else list(SUITES), directory)
    code = 130 if any(r['status'] == 'interrupted' for r in results) else 0 if all(r['status'] == 'passed' for r in results) else 1
    report = {'url': args.url, 'suites': results, 'snapshots': {'status': 'not_requested'}}
    if args.shots:
        report['snapshots'] = {'status': 'skipped'}
        if code == 0:
            try:
                from snapshots import capture
                files = asyncio.run(asyncio.wait_for(capture(args.url, ROOT / 'shots' / 'snapshots'), timeout=300))
                report['snapshots'] = {'status': 'passed', 'files': files}
            except KeyboardInterrupt:
                report['snapshots'] = {'status': 'interrupted'}
                code = 130
            except Exception as error:
                report['snapshots'] = {'status': 'failed', 'error': f'{type(error).__name__}: {error}'}
                print(report['snapshots']['error'], file=sys.stderr)
                code = 1
    report['exit_code'] = code
    path = directory / 'report.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('SUMMARY ' + ', '.join(f"{r['suite']}={r['status']}" for r in results), flush=True)
    print(f"snapshots={report['snapshots']['status']}; exit={code}; report={path}", flush=True)
    return code


if __name__ == '__main__':
    sys.exit(main())

"""One entry for six isolated browser suites and optional deterministic example snapshots."""
import argparse
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import threading
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SUITES = {'main': 'verify.py', 'fsrs': 'verify_fsrs.py', 'sync': 'verify_sync.py',
          'notes': 'verify_notes.py', 'settings': 'verify_settings.py', 'pwa': 'verify_pwa.py'}
DEFAULT_JOBS = 3
SUITE_WEIGHT = {'main': 100, 'pwa': 60, 'notes': 20, 'sync': 18, 'fsrs': 15, 'settings': 5}
_ACTIVE = set()
_ACTIVE_LOCK = threading.Lock()


def site_url(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise argparse.ArgumentTypeError('URL must be an http(s) site root without credentials, query, or fragment')
    return value.rstrip('/') + '/'


def positive_int(value):
    try:
        parsed = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError('must be a positive integer') from error
    if parsed < 1:
        raise argparse.ArgumentTypeError('must be a positive integer')
    return parsed


def _stop_process(process, force=False):
    try:
        if hasattr(os, 'killpg'):
            os.killpg(process.pid, signal.SIGKILL if force else signal.SIGTERM)
        elif force:
            process.kill()
        else:
            process.terminate()
    except (ProcessLookupError, OSError):
        pass


def execute(script, url):
    command = [sys.executable, '-u', str(ROOT / 'tools' / script), url]
    popen_kwargs = {'start_new_session': True} if os.name != 'nt' else {}
    with subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, encoding='utf-8', errors='replace', **popen_kwargs) as process:
        with _ACTIVE_LOCK:
            _ACTIVE.add(process)
        try:
            output, _ = process.communicate(timeout=300)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            _stop_process(process, force=False)
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                _stop_process(process, force=True)
                process.communicate()
            raise
        finally:
            with _ACTIVE_LOCK:
                _ACTIVE.discard(process)
        return process.returncode, output


def _run_one(name, url, directory, run, print_lock):
    with print_lock:
        print(f'RUN {name}', flush=True)
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
    except Exception as error:
        output = f'{type(error).__name__}: {error}\n'
        if isinstance(error, subprocess.TimeoutExpired) and error.output:
            output += error.output.decode(errors='replace') if isinstance(error.output, bytes) else error.output
        result = {'suite': name, 'status': 'failed', 'exit_code': 1}
    log = directory / f'{name}.log'
    log.write_text(output, encoding='utf-8')
    result['log'] = str(log)
    with print_lock:
        print(f'=== {name} ===', flush=True)
        print(output, end='' if output.endswith('\n') else '\n', flush=True)
        print(f"RESULT {name}: {result['status']}", flush=True)
    return result


def run_suites(url, names, directory, run=execute, jobs=1):
    directory.mkdir(parents=True, exist_ok=True)
    print_lock = threading.Lock()
    if jobs <= 1 or len(names) <= 1:
        results = []
        for name in names:
            result = _run_one(name, url, directory, run, print_lock)
            results.append(result)
            if result['status'] == 'interrupted':
                results.extend({'suite': later, 'status': 'skipped'} for later in names[len(results):])
                break
        return results

    # Start heaviest suites first (e.g. main + pwa together) while keeping canonical output order.
    order = sorted(names, key=lambda n: (-SUITE_WEIGHT.get(n, 10), names.index(n)))
    by_name = {}
    pool = ThreadPoolExecutor(max_workers=min(jobs, len(names)))
    futures = {}
    try:
        for name in order:
            futures[pool.submit(_run_one, name, url, directory, run, print_lock)] = name
        for future in as_completed(futures):
            name = futures[future]
            result = future.result()
            by_name[name] = result
            if result['status'] == 'interrupted':
                for other in futures:
                    other.cancel()
                break
    except KeyboardInterrupt:
        for future in futures:
            future.cancel()
        with _ACTIVE_LOCK:
            active = list(_ACTIVE)
        for proc in active:
            _stop_process(proc, force=False)
        for future, name in futures.items():
            if name not in by_name:
                by_name[name] = {'suite': name, 'status': 'skipped' if future.cancelled() else 'interrupted',
                                 **({} if future.cancelled() else {'exit_code': 130})}
    finally:
        pool.shutdown(wait=True, cancel_futures=True)

    for future, name in futures.items():
        if name not in by_name:
            if future.done() and not future.cancelled():
                by_name[name] = future.result()
            else:
                by_name[name] = {'suite': name, 'status': 'skipped'}
    return [by_name[name] for name in names]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url', type=site_url)
    parser.add_argument('--only', choices=SUITES)
    parser.add_argument('--jobs', '-j', type=positive_int, default=DEFAULT_JOBS,
                        help=f'number of browser suites to run in parallel (default: {DEFAULT_JOBS})')
    parser.add_argument('--shots', action='store_true', help='capture local example fixtures in light/dark desktop/mobile')
    args = parser.parse_args(argv)
    directory = ROOT / 'shots' / 'verification'
    results = run_suites(args.url, [args.only] if args.only else list(SUITES), directory, jobs=args.jobs)
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
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / 'report.json'
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('SUMMARY ' + ', '.join(f"{r['suite']}={r['status']}" for r in results), flush=True)
    print(f"snapshots={report['snapshots']['status']}; exit={code}; report={path}", flush=True)
    return code


if __name__ == '__main__':
    sys.exit(main())

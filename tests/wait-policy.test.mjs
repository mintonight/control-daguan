import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('fixed-wait policy rejects sleeps (including aliases and embedded JS) but accepts observable/virtual-clock waits', () => {
  const cases = [
    ['await page.wait_for_timeout(100)', true],
    ['await asyncio.sleep(0.1)', true],
    ['time.sleep(1)', true],
    ['from asyncio import sleep as delay\nawait delay(1)', true],
    ['await page.evaluate("new Promise(r => setTimeout(r, 100))")', true],
    ['await page.wait_for_function("ready()")', false],
    ['await asyncio.wait_for(event.wait(), timeout=10)', false],
    ['await page.clock.run_for(3000)', false],
    ['await idle(page)', false],
  ];
  const result = spawnSync('python3', ['-c', 'import json,sys; from tools.check_waits import violations; print(json.dumps([bool(violations(s)) for s in json.load(sys.stdin)]))'],
    { cwd: root, encoding: 'utf8', input: JSON.stringify(cases.map(([source]) => source)) });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), cases.map(([, rejected]) => rejected));
});
test('repository contains no new fixed browser sleeps', () => {
  const result = spawnSync('python3', ['tools/check_waits.py'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('unified verification entry reports selected suites, failures, timeouts, interruption and bad arguments', () => {
  const result = spawnSync('python3', ['tests/test_verify_all.py'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

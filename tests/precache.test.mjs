import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('precache generation is deterministic, revision-sensitive, and repairs generated drift', () => {
  const result = spawnSync('python3', ['tests/test_precache.py'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
test('upgrade baseline is the exact committed item-9 worker (4b6c934), not a synthetic replacement', () => {
  const bytes = readFileSync(new URL('./fixtures/sw-v9.js', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '0918f8d3801c03dce72336307b4e2c15914a816151d0e1e82f9d5a1680fb99fd');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = join(root, 'node_modules/typescript/bin/tsc');
const run = config => spawnSync(process.execPath, [compiler, '--noEmit', '--allowJs', '--checkJs', '-p', config], { encoding: 'utf8', cwd: root, timeout: 30000 });
test('strict JS/JSDoc domain and boundary coverage compiles with no emit', () => {
  const result = run('tsconfig.json');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
test('compiler rejects invalid preferences, mark grades, saved dates, question text and favorite IDs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdg-type-contract-'));
  try {
    const module = name => JSON.stringify(resolve(root, `public/src/${name}.js`));
    const fixture = join(dir, 'invalid.mjs');
    writeFileSync(fixture, `import {normRec} from ${module('core/record')};
import {setMode, setFontScale} from ${module('core/preferences')};
import {review} from ${module('srs/fsrs')};
import {parseLibrary} from ${module('core/question')};
const rec = normRec({});
setMode(rec, 'triple');
setFontScale(rec, 99);
review(undefined, 202401, 'easy', 0.9);
rec.srs['202401'].card.due = new Date();
parseLibrary({}).questions[0].stem = 42;
normRec({favorites: ['202401']});
`);
    const config = join(dir, 'tsconfig.json');
    writeFileSync(config, JSON.stringify({ extends: join(root, 'tsconfig.json'), include: [fixture, join(root, 'types/**/*.d.ts')] }));
    const result = run(config);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    const errors = result.stdout.split('\n').filter(l => /error TS/.test(l));
    assert.equal(errors.length, 6, result.stdout + result.stderr);
    for (const line of [6, 7, 8, 9, 10, 11]) assert.ok(errors.some(e => e.includes(`invalid.mjs(${line},`)), result.stdout);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

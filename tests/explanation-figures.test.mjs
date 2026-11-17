import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const bode = {
  201904: 'b2019-4-1.png',
  201905: 'b2019-5-1.png',
  202104: 'b2021-4-1.png',
  202405: 'b2024-5-1.png',
  202504: 'b2025-4-1.png',
  202604: 'b2026-4-1.png',
};

test('Bode explanations embed a generated figure that the build publishes once', () => {
  for (const [idText, name] of Object.entries(bode)) {
    const id = Number(idText);
    const year = Math.floor(id / 100);
    const source = JSON.parse(readFileSync(new URL(`data-src/${year}/questions.json`, root))).questions.find(q => q.no === id % 100);
    const ref = `](img/${name})`;
    assert.ok(source.explanation.includes(ref), `${id} explanation`);
    assert.ok(source.answer.includes(ref), `${id} answer`);
    assert.ok(existsSync(new URL(`data-src/${year}/img/${name}`, root)));
    assert.ok(existsSync(new URL(`public/img/${name}`, root)), `${name} missing from public/img; run tools/build_data.py`);
    const published = JSON.parse(readFileSync(new URL(`public/data/questions/${id}.json`, root)));
    assert.equal(published.explanation, source.explanation);
    assert.equal(published.answer, source.answer);
  }
});

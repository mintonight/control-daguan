import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLibrary, parseQuestionDetail } from '../public/src/core/question.js';
import { normRec } from '../public/src/core/record.js';
import * as prefs from '../public/src/core/preferences.js';
import * as FSRS from 'ts-fsrs';

const library = JSON.parse(readFileSync(new URL('../public/data/library.json', import.meta.url), 'utf8'));
test('all generated questions cross the unknown JSON boundary with typed fields intact', () => {
  assert.deepEqual(parseLibrary(library), library);
  for (const q of library.questions) {
    const raw = JSON.parse(readFileSync(new URL(`../public/data/questions/${q.id}.json`, import.meta.url), 'utf8'));
    // Optional errataLevel stays absent from JSON when undefined.
    assert.deepEqual(JSON.parse(JSON.stringify(parseQuestionDetail(raw))), raw);
  }
});
test('question boundary rejects incorrect fields instead of caching an untyped payload', () => {
  for (const bad of [null, [], {}, { ...library, years: ['2026'] }, { ...library, questions: [{ ...library.questions[0], stem: 42 }] },
    { ...library, lists: [{ ...library.lists[0], categoryByQuestion: { '202601': [42] } }] }]) {
    assert.throws(() => parseLibrary(bad), TypeError);
  }
  const raw = { answer: '', explanation: '', notes: '', answerPdfPages: '', originalImages: [] };
  assert.deepEqual(parseQuestionDetail(raw).originalImages, []);
  for (const bad of [{ ...raw, answer: 2 }, { ...raw, originalImages: [{ src: 'img/a.png', w: '100' }] }]) {
    assert.throws(() => parseQuestionDetail(bad), TypeError);
  }
});
test('legacy v1 record without notes/updated/learning_steps still normalizes and reviews without rewriting its saved card', async () => {
  const card = { due: '2023-11-15T00:00:00.000Z', last_review: '2023-11-14T00:00:00.000Z', stability: 1, difficulty: 6,
    scheduled_days: 1, reps: 1, lapses: 0, state: 2 };
  const old = { favorites: [202301], marks: { '202301': { state: 'unknown', at: 1700000000000 } },
    srs: { '202301': { card, logs: [{ id: '202301-old', review: card.last_review }] } }, fontScale: 115, retention: 0.85 };
  const before = structuredClone(old), rec = normRec(old);
  assert.deepEqual(rec.favorites, [202301]); assert.deepEqual(rec.marks, old.marks);
  assert.deepEqual(rec.srs, old.srs); assert.deepEqual(rec.notes, {}); assert.deepEqual(rec.updated, {});
  assert.equal(rec.fontScale, 115); assert.equal(rec.retention, 0.85); assert.equal(rec.mode, 'single');
  globalThis.FSRS = FSRS;
  try {
    const { preview, review } = await import('../public/src/srs/fsrs.js');
    const now = new Date('2026-11-16T04:00:00Z');
    const pv = preview(rec.srs['202301'], rec.retention, now);
    assert.ok(Object.values(pv).every(d => d instanceof Date && Number.isFinite(d.getTime())));
    const next = review(rec.srs['202301'], 202301, 'shaky', rec.retention, now);
    assert.equal(typeof next.card.due, 'string'); assert.equal(next.logs.length, 2);
    assert.deepEqual(old, before); assert.equal('learning_steps' in rec.srs['202301'].card, false);
  } finally { delete globalThis.FSRS; }
});
test('typed preference setters change only their own field and reject illegal values before mutation', () => {
  const initial = normRec({}), rec = structuredClone(initial);
  prefs.setMode(rec, 'multiple'); prefs.setFontScale(rec, 115); prefs.setCollapsed(rec, true); prefs.setSettingsSection(rec, 'records');
  assert.deepEqual(rec, { ...initial, mode: 'multiple', fontScale: 115, collapsed: true, setSec: 'records' });
  const before = structuredClone(rec);
  assert.throws(() => prefs.setMode(rec, 'triple'), TypeError);
  assert.throws(() => prefs.setFontScale(rec, 99), TypeError);
  assert.throws(() => prefs.setCollapsed(rec, 1), TypeError);
  assert.throws(() => prefs.setSettingsSection(rec, 'missing'), TypeError);
  assert.deepEqual(rec, before);
});

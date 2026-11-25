import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from 'ts-fsrs';
process.env.TZ = 'Asia/Tokyo';
globalThis.FSRS = F;
const {review, preview} = await import('../public/src/srs/fsrs.js');
const {dueIds} = await import('../public/src/core/studyday.js');
const {mergeRecords} = await import('../public/src/core/merge.js');
const at = s => new Date(s);
const first = at('2026-11-10T10:00:00+09:00');
const now = at('2026-11-20T23:00:00+09:00');
const edit = at('2026-11-21T01:30:00+09:00');

test('due review stays today after rating, reload/merge and correction; clears at 2AM', () => {
  const old = review(undefined, 1, 'unknown', .9, first);
  const rated = review(old, 1, 'mastered', .9, now);
  assert.deepEqual(dueIds({1: rated}, now), [1]);
  assert.deepEqual(dueIds(JSON.parse(JSON.stringify({1: rated})), edit), [1]);
  const changed = review(rated, 1, 'shaky', .9, edit);
  const expected = review(old, 1, 'shaky', .9, edit);
  assert.deepEqual(changed.card, expected.card);
  assert.equal(changed.logs.length, 2);
  assert.equal(changed.logs.at(-1).id, rated.logs.at(-1).id);
  assert.deepEqual(preview(changed, .9, edit), preview(old, .9, edit));
  const r = (srs, updated) => ({srs: {1: srs}, updated: {1: updated}});
  for (const policy of ['sync', 'import']) {
    const merged = mergeRecords(r(changed, +edit), r(rated, +now), policy);
    assert.deepEqual(merged.srs[1], changed);
    assert.deepEqual(mergeRecords(r(rated, +now), r(changed, +edit), policy).srs[1], changed);
    assert.deepEqual(dueIds(merged.srs, edit), [1]);
  }
  assert.deepEqual(dueIds({1: changed}, at('2026-11-21T02:00:00+09:00')), []);
});

test('new ratings are not added to due queue; same-day edits do not inflate reps/lapses', () => {
  const a = review(undefined, 1, 'unknown', .9, now);
  assert.deepEqual(dueIds({1: a}, now), []);
  let b = a;
  for (const mark of ['mastered', 'unknown', 'shaky', 'mastered']) {
    b = review(b, 1, mark, .9, edit);
    assert.deepEqual(b.card, review(undefined, 1, mark, .9, edit).card);
    assert.equal(b.logs.length, 1);
  }
  const nextDay = review(b, 1, 'unknown', .9, at('2026-11-22T10:00:00+09:00'));
  assert.equal(nextDay.card.reps, 2);
  assert.equal(nextDay.logs.length, 2);
});

test('retained queue keeps overdue order and excludes early reviews and unknown question IDs', () => {
  const old = review(undefined, 2, 'unknown', .9, first);
  const early = review(undefined, 3, 'mastered', .9, now);
  const due = {...old.card, due: '2026-11-19T00:00:00Z'};
  const rated = review(old, 2, 'mastered', .9, now);
  assert.deepEqual(dueIds({1: {card: due, logs: []}, 2: rated, 3: early}, edit), [2, 1]);
  assert.deepEqual(dueIds({1: old, 2: rated}, edit, id => id === 1), [1]);
});

test('truncated logs still permit correction; earlier lapse is preserved, current lapse can be undone', () => {
  let entry = review(undefined, 1, 'unknown', .9, first);
  entry = review(entry, 1, 'unknown', .9, at('2026-11-12T10:00:00+09:00'));
  assert.equal(entry.card.lapses, 1);
  const rated = review(entry, 1, 'unknown', .9, now);
  const truncated = JSON.parse(JSON.stringify({...rated, logs: rated.logs.slice(-1)}));
  const corrected = review(truncated, 1, 'mastered', .9, edit);
  assert.deepEqual(corrected.card, review(entry, 1, 'mastered', .9, edit).card);
  assert.equal(corrected.card.lapses, 1);
  assert.equal(corrected.logs.length, 1);
});

test('an existing card reviewed early is not added to today, including after correction', () => {
  const entry = review(undefined, 1, 'mastered', .9, first);
  const earlyTime = at('2026-11-11T10:00:00+09:00');
  const early = review(entry, 1, 'mastered', .9, earlyTime);
  assert.deepEqual(dueIds({1: early}, earlyTime), []);
  const corrected = review(early, 1, 'shaky', .9, at(+earlyTime + 60e3));
  assert.deepEqual(dueIds({1: corrected}, earlyTime), []);
});

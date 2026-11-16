// mergeRecords 的性质测试（fast-check）：交换律、结合律、幂等、日志不丢、较新卡片胜出、笔记不被覆盖。
// 复现失败用例：FC_SEED=<种子> npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { mergeRecords, canon } from '../public/src/core/merge.js';
const RUNS = { numRuns: +(process.env.FC_RUNS || 400), ...(process.env.FC_SEED ? { seed: +process.env.FC_SEED } : {}) };
const POLICIES = ['sync', 'import'];

// 小取值空间：故意制造同一时刻、同一日志 id、同一题号的冲突
const qid = fc.constantFrom('1', '2', '3');
// 所有时间共用同一刻度（2026-01-01 起的第 0–6 天），这样“重置”“标记”“复习”的先后关系能任意组合
const day = fc.integer({ min: 0, max: 6 });
const t = day.map(n => Date.UTC(2026, 0, 1 + n));
const iso = t.map(ms => new Date(ms).toISOString());
const logOf = q => fc.record({ id: fc.integer({ min: 0, max: 4 }).map(n => `${q}-${n}`), rating: fc.constantFrom(1, 2, 3), review: iso });
const entry = q => fc.record({ card: fc.record({ due: iso, last_review: iso, reps: fc.integer({ min: 0, max: 3 }) }), logs: fc.array(logOf(q), { maxLength: 3 }) });
const dict = (val, maxKeys = 3) => fc.uniqueArray(qid, { maxLength: maxKeys }).chain(ks => fc.tuple(...ks.map(k => val(k))).map(vs => Object.fromEntries(ks.map((k, i) => [k, vs[i]]))));
const record = fc.record({
  favorites: fc.uniqueArray(fc.constantFrom(1, 2, 3), { maxLength: 3 }),
  marks: dict(() => fc.record({ state: fc.constantFrom('shaky', 'unknown', 'mastered'), at: t })),
  srs: dict(entry),
  updated: dict(() => t),
  notes: dict(() => fc.record({ text: fc.constantFrom('', 'a', 'b'), at: t })),
  history: fc.array(fc.record({ id: fc.constantFrom(1, 2, 3), state: fc.constantFrom('shaky', null), at: t }), { maxLength: 3 }),
  retention: fc.constantFrom(0.85, 0.9),
  retentionAt: fc.oneof(fc.constant(0), t),
});
const same = (x, y, msg) => assert.equal(canon(x), canon(y), msg);
const ts = (r, id) => Math.max(+(r.updated?.[id]) || 0, +(r.marks?.[id]?.at) || 0, Date.parse(r.srs?.[id]?.card?.last_review || '') || 0);
// 某题的“删除方”：提到了这题、却没有卡片的一方（重置复习进度或从未复习）
const cardless = (r, id) => ts(r, id) > 0 && !r.srs?.[id];

for (const policy of POLICIES) {
  const M = (a, b) => mergeRecords(a, b, policy);

  test(`[${policy}] 交换律`, () => fc.assert(fc.property(record, record, (a, b) => {
    same(M(a, b), M(b, a));
  }), RUNS));

  test(`[${policy}] 幂等与吸收：再合并任一输入或结果本身不改变结果`, () => fc.assert(fc.property(record, record, (a, b) => {
    const m = M(a, b);
    same(M(m, m), m); same(M(m, a), m); same(M(m, b), m);
  }), RUNS));

  test(`[${policy}] 结合律`, () => fc.assert(fc.property(record, record, record, (a, b, c) => {
    const l = M(M(a, b), c), r = M(a, M(b, c));
    const strip = x => ({ ...x, srs: Object.fromEntries(Object.entries(x.srs).map(([k, v]) => [k, v.card])) });
    same(strip(l), strip(r), '除复习日志外');
    // 同步策略下，若某题有一方“没有卡片”（重置），先合并的组合会先丢掉那一侧以前的日志，所以日志只在没有这种情况时满足结合律
    const ids = Object.keys(l.srs).filter(id => policy === 'import' || ![a, b, c].some(x => cardless(x, id)));
    for (const id of ids) same(l.srs[id].logs, r.srs[id].logs, `题 ${id} 的日志`);
  }), RUNS));

  test(`[${policy}] 复习日志不丢：结果有卡片时，包含双方的全部日志 id`, () => fc.assert(fc.property(record, record, (a, b) => {
    const m = M(a, b);
    for (const [id, v] of Object.entries(m.srs)) {
      const got = new Set(v.logs.map(l => l.id));
      for (const l of [...(a.srs[id]?.logs || []), ...(b.srs[id]?.logs || [])]) assert.ok(got.has(l.id), `题 ${id} 丢了日志 ${l.id}`);
      assert.equal(got.size, v.logs.length, '日志 id 去重');
    }
  }), RUNS));

  test(`[${policy}] 笔记不被覆盖：每题保留 at 较新的一方，任何一方的笔记都不会消失`, () => fc.assert(fc.property(record, record, (a, b) => {
    const m = M(a, b);
    for (const id of new Set([...Object.keys(a.notes), ...Object.keys(b.notes)])) {
      const x = a.notes[id], y = b.notes[id], n = m.notes[id];
      assert.ok(n, `题 ${id} 的笔记消失了`);
      assert.equal(n.at, Math.max(x?.at || 0, y?.at || 0));
      if (x && y && x.at !== y.at) assert.equal(n.text, (x.at > y.at ? x : y).text);
    }
  }), RUNS));
}

test('[sync] 较新的一方整体胜出：卡片、标记、收藏都来自更新时间较晚的一方（含删除）', () => fc.assert(fc.property(record, record, (a, b) => {
  const m = mergeRecords(a, b, 'sync');
  for (const id of ['1', '2', '3']) {
    const ta = ts(a, id), tb = ts(b, id); if (ta === tb) continue;
    const w = tb > ta ? b : a;
    same(m.srs[id]?.card ?? null, w.srs[id]?.card ?? null, `题 ${id} 卡片`);
    same(m.marks[id] ?? null, w.marks[id] ?? null, `题 ${id} 标记`);
    assert.equal(m.favorites.includes(+id), w.favorites.includes(+id), `题 ${id} 收藏`);
  }
}), RUNS));

test('[sync] 双方时间相同（含都没有时间戳的旧数据）时收藏取并集，不会丢', () => fc.assert(fc.property(record, record, (a, b) => {
  const m = mergeRecords(a, b, 'sync');
  for (const id of [1, 2, 3]) if (ts(a, id) === ts(b, id) && (a.favorites.includes(id) || b.favorites.includes(id))) assert.ok(m.favorites.includes(id));
}), RUNS));

test('[import] 只增不删：最近复习的卡片胜出，收藏取并集，标记取较新的 at', () => fc.assert(fc.property(record, record, (a, b) => {
  const m = mergeRecords(a, b, 'import');
  const lr = c => Date.parse(c.last_review);
  for (const id of ['1', '2', '3']) {
    const ca = a.srs[id]?.card, cb = b.srs[id]?.card;
    if (ca || cb) assert.equal(lr(m.srs[id].card), Math.max(ca ? lr(ca) : -Infinity, cb ? lr(cb) : -Infinity));
    const ma = a.marks[id], mb = b.marks[id];
    if (ma || mb) assert.equal(m.marks[id].at, Math.max(ma?.at ?? -1, mb?.at ?? -1));
    assert.equal(m.favorites.includes(+id), a.favorites.includes(+id) || b.favorites.includes(+id));
  }
}), RUNS));

test('与空记录合并等于自身规范化后的结果；不修改入参', () => fc.assert(fc.property(record, record, (a, b) => {
  const ca = canon(a), cb = canon(b);
  for (const p of POLICIES) { same(mergeRecords(a, {}, p), mergeRecords({}, a, p)); mergeRecords(a, b, p); }
  assert.equal(canon(a), ca); assert.equal(canon(b), cb);
}), RUNS));

test('旧缺失记忆率字段保留非冲突分支的回退行为', () => {
  assert.equal(mergeRecords({ retentionAt: 42 }, { retention: 0.85, retentionAt: 1 }).retention, 0.85);
});

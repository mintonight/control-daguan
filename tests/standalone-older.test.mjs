import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const rows = new Map();
for (const year of [2016, 2017, 2018, 2019]) {
  for (const q of JSON.parse(readFileSync(new URL(`../data-src/${year}/questions.json`, import.meta.url))).questions) rows.set(year * 100 + q.no, q);
}
const q = id => rows.get(id);
const near = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
test('2016–2019 inventory distinguishes 21 written records from 12 original-image-only records', () => {
  assert.equal(rows.size, 33); // 2019 contains nine questions, not eight.
  assert.equal([...rows.values()].filter(x => x.answer && x.explanation).length, 21);
  for (const [id, row] of rows) {
    if (!row.answer) { assert.equal(row.explanation, ''); assert.ok(row.answerImages.length); continue; }
    for (const field of ['answer', 'explanation']) {
      assert.ok([...row[field]].every(char => char === '\n' || char.charCodeAt(0) >= 32));
      assert.doesNotMatch(row[field], /原图|原解|原书|见原答案|答案中的|即上述|不是.*(?:对的|符号)/, `${id}.${field}`);
    }
    const published = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url)));
    for (const field of ['answer', 'explanation', 'notes']) assert.equal(row[field] ?? '', published[field]);
  }
});
test('standalone state, operating-point and plot constructions retain legitimate question-diagram references', () => {
  assert.ok(q(201601).explanation.includes('D=0'));
  assert.ok(q(201701).explanation.includes('x=[i_a'));
  assert.ok(q(201801).explanation.includes('Q_{10}=Q_{20}'));
  assert.ok(q(201908).explanation.includes('x=P\\tilde x'));
  for (const id of [201603, 201604, 201706, 201901, 201905]) assert.match(q(id).explanation, /作图|画图|绘图/);
  assert.ok(q(201905).explanation.includes('-20,-40,-20,-40,-60'));
  assert.ok(q(201901).explanation.includes('题干'));
});
test('201804 gain-change directions independently match requested dB and phase margins', () => {
  assert.ok(q(201804).explanation.includes('K_{\\mathrm{new}}/K_{\\mathrm{old}}'));
  const oldMagnitude = .6, targetMarginDb = 20;
  const newOverOld = 10 ** (-targetMarginDb / 20) / oldMagnitude;
  near(newOverOld, 1 / 6); near(-20 * Math.log10(oldMagnitude * newOverOld), 20);
  near(4.18 * (1 / 4.18), 1); near(180 - 140, 40);
});
test('201707 exact held first-order pole reproduces all real-gain stability cases', () => {
  assert.ok(q(201707).answer.includes('-1<K\\le1'));
  for (const K of [-2, -1, -.9, 0, .5, 1, 1.01, 2, 10]) for (const T of [.01, .2, 1, 5, 10]) {
    const a = Math.exp(-T), pole = a - K * (1 - a);
    const stated = K > -1 && (K <= 1 || T < Math.log((K + 1) / (K - 1)));
    assert.equal(Math.abs(pole) < 1, stated);
  }
});
test('201801 small-deviation linearization is local at a positive equilibrium, not an exact nonlinear identity', () => {
  assert.ok(q(201801).explanation.includes('h_0>0'));
  for (const h0 of [.2, 1, 10]) for (const a of [.5, 3]) {
    const derivative = a / (2 * Math.sqrt(h0));
    const error = e => a * (Math.sqrt(h0 + e) - Math.sqrt(h0)) - derivative * e;
    near(error(1e-4) / error(5e-5), 4, .002);
  }
});
test('201806 delay design identifies the first crossing branch and harmonic approximation', () => {
  assert.ok(q(201806).explanation.includes('首个相角穿越'));
  assert.ok(q(201806).answer.includes('描述函数'));
  const K = Math.PI * Math.sqrt(10), tau = Math.atan(1 / 3), w = 1;
  near(K / Math.sqrt(10) * (1 / Math.PI), 1);
  near(Math.PI / 2 + Math.atan(w) + Math.atan(w / 2) + w * tau, Math.PI);
  for (const n of [1, 2]) near(Math.sin(Math.PI / 2 + Math.atan(w) + Math.atan(w / 2) + tau + 2 * Math.PI * n), 0);
});
test('201907 exact pulse recurrence matches independent held-input continuous evolution', () => {
  assert.ok(q(201907).explanation.includes('a=e^{-10T}'));
  const T = .07, a = Math.exp(-10 * T), b = T - (1 - a) / 10, d = (1 - a) / 10 - T * a;
  let y = 0, v = 0;
  const c = [0];
  for (let n = 0; n < 4; n++) {
    const input = 1 - y;
    [y, v] = [y + (1 - a) / 10 * v + b * input, a * v + (1 - a) * input];
    c.push(y);
  }
  near(c[1], b);
  for (let n = 2; n < c.length; n++) near(c[n], (1 + a - b) * c[n - 1] - (a + d) * c[n - 2] + b + d);
  near(c[2], .0643, 5e-5); near(c[3], .1201, 5e-5);
});

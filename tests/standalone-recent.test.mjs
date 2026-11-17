import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const byId = new Map();
for (const year of [2023, 2024, 2025, 2026]) {
  const source = JSON.parse(readFileSync(new URL(`../data-src/${year}/questions.json`, import.meta.url)));
  for (const q of source.questions) byId.set(year * 100 + q.no, q);
}
const q = id => byId.get(id);
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('all 32 recent written solutions stand independently of original answer scans', () => {
  assert.equal(byId.size, 32);
  for (const [id, row] of byId) {
    assert.ok(row.answer && row.explanation, `${id}: written coverage`);
    for (const field of ['answer', 'explanation']) {
      // This intentionally permits references to the QUESTION diagram and to the physical system.
      assert.doesNotMatch(row[field], /见原图解析|曲线见原图|原答案|原解(?:误|提出|取|的|的通常)|照抄原图|原图相频曲线/, `${id}.${field}`);
    }
    const published = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url)));
    for (const field of ['answer', 'explanation', 'notes']) assert.equal(published[field], row[field] ?? '');
  }
  assert.doesNotMatch(q(202302).answer + q(202302).explanation, /已按新图重算|按新图列/);
  assert.ok(q(202401).explanation.includes('图 (b)'));
  assert.ok(q(202408).explanation.includes('题干'));
});

test('requested sketches have explicit construction recipes, not an unavailable original-answer reference', () => {
  for (const id of [202303, 202304, 202403, 202404, 202405, 202503, 202504, 202506, 202603, 202604, 202606]) {
    const text = q(id).answer + q(id).explanation;
    if (id === 202304) assert.match(text, /!\[[^\]]+\]\(img\/solution-202304-bode\.svg\)/);
    else assert.match(text, /绘图|作图/);
    assert.doesNotMatch(text, /见原图解析|曲线见原图/);
  }
  assert.ok(q(202405).explanation.includes('校正器自身'));
  assert.ok(q(202405).explanation.includes('-20,0,+20,+40,+20,0'));
  assert.ok(q(202606).explanation.includes('横轴 $A>0$'));
  assert.ok(q(202606).explanation.includes('纵轴 $N(A)$'));
  assert.ok(q(202606).explanation.includes('$(0,-1.5)$'));
  assert.ok(q(202506).explanation.includes('关于实轴对称'));
});

test('state and feedback definitions are complete without consulting an answer image', () => {
  assert.ok(q(202308).answer.includes('u=-kx'));
  assert.ok(q(202408).answer.includes('r=v-Kx'));
  assert.ok(q(202408).explanation.includes('x_1=y'));
  assert.ok(q(202501).explanation.includes('从节点 $A$ 经电感流向输出'));
  assert.ok(q(202601).explanation.includes('x_1=q'));
  assert.ok(q(202601).explanation.includes('x_2=\\dot q'));
  assert.ok(q(202608).explanation.includes('A=\\begin{bmatrix}0&1&0'));
  assert.doesNotMatch(q(202608).explanation, /答案中的三阶/);
  assert.ok(q(202607).explanation.includes('第1问所列'));
});

test('202305 symbolic period solution and initial-sample formulas match exact held-input plant evolution', () => {
  const row = q(202305);
  assert.ok(row.answer.includes('T=\\tau'));
  assert.ok(row.answer.includes('\\min'));
  assert.ok(row.answer.includes('1+a-2b'));
  assert.ok(row.explanation.includes('不能唯一'));
  for (const T of [.05, .1, .5, 1, 2, 4]) {
    const a = Math.exp(-2 * T), b = T / 2 - (1 - a) / 4, d = (1 - a) / 4 - T * a / 2;
    assert.ok(b > d && d > 0);
    const bound = Math.min((1 - a) / d, 2 * (1 + a) / (b - d));
    for (const factor of [.05, .5, .99, 1.01, 2]) {
      const k = factor * bound, a1 = k * b - 1 - a, a0 = a + k * d;
      const disc = a1 * a1 - 4 * a0;
      const maxMod = disc < 0 ? Math.sqrt(a0) : Math.max(Math.abs((-a1 + Math.sqrt(disc)) / 2), Math.abs((-a1 - Math.sqrt(disc)) / 2));
      assert.equal(maxMod < 1, factor < 1);
    }
    for (const r of [[1, 1, 1], [0, 2, -1], [-3, .5, 2]]) {
      const k = 2, h = (1 - a) / 2;
      let y = 0, v = (.5 - k * b * r[0]) / h;
      const sampled = [y];
      for (const input of r) {
        const error = input - y;
        [y, v] = [y + h * v + k * b * error, a * v + k * h * error];
        sampled.push(y);
      }
      near(sampled[1], .5);
      const c2 = .5 * (1 + a - 2 * b) + 2 * b * r[1] + 2 * d * r[0];
      const c3 = (1 + a - 2 * b) * c2 - .5 * (a + 2 * d) + 2 * b * r[2] + 2 * d * r[1];
      near(c2, sampled[2]); near(c3, sampled[3]);
    }
  }
});

test('Nyquist construction formulas and the compensator Bode slopes follow their transfer functions', () => {
  for (const w of [.01, .3, 1, Math.sqrt(2), 2, Math.sqrt(11), 9]) {
    const reDen = 6 * (1 - w * w), imDen = w * (11 - w * w);
    const re = 15 * reDen / (reDen ** 2 + imDen ** 2), im = -15 * imDen / (reDen ** 2 + imDen ** 2);
    const modulus = 15 / Math.sqrt((1 + w * w) * (4 + w * w) * (9 + w * w));
    near(Math.hypot(re, im), modulus);
    if (w === 1) { near(re, 0); near(im, -1.5); }
    if (w === Math.sqrt(11)) { near(re, -.25); near(im, 0); }
    const d2 = (w * w + 1) * (w * w + 4);
    const relayRe = -3 / d2, relayIm = (w * w - 2) / (w * d2);
    near(Math.hypot(relayRe, relayIm), 1 / (w * Math.sqrt(1 + w * w) * Math.sqrt(4 + w * w)));
  }
  const zeros = [1, 2, 3], poles = [10, 20];
  const slopes = [0.1, 1.5, 2.5, 5, 15, 100].map(w => -20 + 20 * zeros.filter(z => w > z).length - 20 * poles.filter(p => w > p).length);
  assert.deepEqual(slopes, [-20, 0, 20, 40, 20, 0]);
  near(Math.sqrt(6) * 2 / (3 * Math.PI), .5197978674891174);
});

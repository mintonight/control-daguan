import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ids = [202304, 202305, 202502, 202505, 202506, 202602, 202603, 202604, 202605, 202606, 202608];
const question = id => JSON.parse(readFileSync(new URL(`../data-src/${Math.floor(id / 100)}/questions.json`, import.meta.url))).questions.find(q => q.no === id % 100);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const mul = (a, b) => {
  const out = Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j] += x * y; }));
  return out;
};
const add = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
const routh = coefficients => {
  const n = coefficients.length, width = Math.ceil(n / 2);
  const rows = Array.from({ length: n }, () => Array(width).fill(0));
  for (let j = 0; j < width; j++) { rows[0][j] = coefficients[2 * j] ?? 0; rows[1][j] = coefficients[2 * j + 1] ?? 0; }
  for (let i = 2; i < n; i++) for (let j = 0; j < width - 1; j++) {
    assert.notEqual(rows[i - 1][0], 0);
    rows[i][j] = (rows[i - 1][0] * rows[i - 2][j + 1] - rows[i - 2][0] * rows[i - 1][j + 1]) / rows[i - 1][0];
  }
  return rows.map(row => row[0]);
};
const quadraticStable = (b, c) => {
  const disc = b * b - 4 * c;
  if (disc < 0) return Math.sqrt(c) < 1;
  return Math.max(Math.abs((-b + Math.sqrt(disc)) / 2), Math.abs((-b - Math.sqrt(disc)) / 2)) < 1;
};
const bisect = (f, low, high) => {
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (f(mid) > 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
};

test('202604 both counterexamples meet magnitude, >=40 degree margin and closed-loop Routh stability', () => {
  const q = question(202604);
  assert.ok(q.notes.includes('两级'));
  assert.ok(q.notes.includes('衰减'));
  assert.doesNotMatch(q.notes, /题设本身有问题|单级超前理论上达不到/);
  assert.equal(q.errataLevel, 'severe');
  const baseDen = [0, 0, 1, 1];
  const mu = 4 * Math.sqrt(5), tz = Math.sqrt(mu) / 2, tp = 1 / (2 * Math.sqrt(mu));
  const kappa = Math.sqrt(1.01) / 300;
  for (const { w, zeros, poles, gain } of [
    { w: 2, zeros: [tz, tz], poles: [tp, tp], gain: 1 },
    { w: .1, zeros: [30], poles: [10 / 3], gain: kappa }
  ]) {
    const magnitude = gain * zeros.reduce((m, t) => m * Math.hypot(1, t * w), 1) / (w * w * Math.hypot(1, w) * poles.reduce((m, t) => m * Math.hypot(1, t * w), 1));
    const margin = (-Math.atan(w) + zeros.reduce((a, t) => a + Math.atan(t * w), 0) - poles.reduce((a, t) => a + Math.atan(t * w), 0)) * 180 / Math.PI;
    close(magnitude, 1);
    assert.ok(margin >= 40);
    const num = zeros.reduce((p, t) => mul(p, [1, t]), [gain]);
    const den = poles.reduce((p, t) => mul(p, [1, t]), baseDen);
    assert.ok(routh(add(den, num).reverse()).every(v => v > 0));
  }
  const original = routh([.31, 1.31, 1, 2.34, 1]);
  assert.equal(original.slice(1).filter((x, i) => Math.sign(x) !== Math.sign(original[i])).length, 2);
});

const matMul = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0)));
const determinant = a => a.length === 1 ? a[0][0] : a[0].reduce((sum, x, j) => sum + (-1) ** j * x * determinant(a.slice(1).map(row => row.filter((_, k) => k !== j))), 0);
function inverse(a) {
  const det = determinant(a);
  return a.map((_, i) => a.map((__, j) => (-1) ** (i + j) * determinant(a.filter((_, k) => k !== j).map(row => row.filter((_, k) => k !== i))) / det));
}
test('202608 the third pole belongs to an explicitly added controller state, not a 2-state coordinate change', () => {
  const q = question(202608), text = q.answer + q.explanation;
  assert.ok(text.includes('静态状态反馈'));
  assert.ok(text.includes('额外积分状态'));
  assert.ok(text.includes('零初始'));
  assert.ok(q.notes.includes('条件'));
  const A = [[0, 1, 0], [0, 0, 1], [0, -3, -2]], B = [[0], [0], [1]], C = [[0, 2, 0]], K = [[4, 3, 2]];
  const BK = matMul(B, K), closed = A.map((row, i) => row.map((x, j) => x - BK[i][j]));
  const AB = matMul(A, B), AAB = matMul(A, AB);
  close(determinant(B.map((row, i) => [row[0], AB[i][0], AAB[i][0]])), -1);
  const CA = matMul(C, A), CAA = matMul(CA, A);
  close(determinant([C[0], CA[0], CAA[0]]), 0);
  for (const s of [.1, 1, 2, 9]) {
    const resolvent = matrix => matrix.map((row, i) => row.map((x, j) => (i === j ? s : 0) - x));
    close(matMul(matMul(C, inverse(resolvent(A))), B)[0][0], 2 / (s * s + 2 * s + 3));
    close(determinant(resolvent(closed)), (s + 2) * (s * s + 2 * s + 2));
    close(matMul(matMul(C, inverse(resolvent(closed))), B)[0][0], 2 * s / (s ** 3 + 4 * s * s + 6 * s + 4));
  }
});

test('202506 positive frequency crosses from third to second quadrant with the stated low/high asymptotes', () => {
  const q = question(202506);
  assert.ok(q.explanation.includes('第二象限'));
  assert.ok(q.explanation.includes('-3K/4'));
  assert.ok(q.explanation.includes('描述函数'));
  const re = w => -3 / (w ** 4 + 5 * w * w + 4);
  const im = w => (w * w - 2) / (w * (w ** 4 + 5 * w * w + 4));
  close(re(2), -3 / 40); close(im(2), 1 / 40);
  for (const w of [.01, 1, 1.4]) assert.ok(re(w) < 0 && im(w) < 0);
  for (const w of [1.5, 2, 10]) assert.ok(re(w) < 0 && im(w) > 0);
  close(re(1e-6), -.75, 1e-10); close(1e-6 * im(1e-6), -.5, 1e-10);
  close(1e4 ** 3 * im(1e4), 1, 1e-6);
  for (const K of [2.1, 3, 5.9]) {
    const amplitude = (3 * K - 6) / (6 - K);
    close((amplitude + 3) / (amplitude + 1), 6 / K);
  }
});

test('202603 correct reciprocal preserves the final breakpoint/gain pairing and discriminant', () => {
  const q = question(202603);
  assert.ok(q.notes.includes('倒数'));
  assert.ok(q.notes.includes('12K^*'));
  assert.notEqual(q.errataLevel, 'ok');
  for (const sign of [-1, 1]) {
    const s = -3 + sign * Math.sqrt(3);
    const gain = -s * (s + 2) / ((s + 4) * (s + 6));
    close(gain, 7 - sign * 4 * Math.sqrt(3));
    close((1 + gain) * s * s + (2 + 10 * gain) * s + 24 * gain, 0);
    close((2 + 10 * gain) ** 2 - 4 * (1 + gain) * 24 * gain, 0, 1e-10);
  }
  for (const gain of [.1, 1, 10]) assert.ok(4 * (gain * gain - 14 * gain + 1) < 0);
  for (const gain of [-2, -3, -10]) {
    assert.ok((2 + 10 * gain) / (1 + gain) > 0);
    assert.ok(24 * gain / (1 + gain) > 0);
  }
});

test('202304 phase initially rises; exact and piecewise crossover figures are different calculations', () => {
  const q = question(202304);
  assert.ok(q.answer.includes('折线近似'));
  assert.ok(q.explanation.includes('47/150'));
  assert.notEqual(q.errataLevel, 'ok');
  const phase = w => -Math.PI / 2 + Math.atan(w / 2) + Math.atan(w / 3) - Math.atan(w / 2.5) - Math.atan(w / 10) - Math.atan(w / 50);
  close((phase(1e-6) - phase(0)) / 1e-6, 47 / 150, 1e-9);
  close(phase(1) * 180 / Math.PI, -73.65776546202656, 1e-7);
  const magnitude = w => 500 * Math.hypot(w, 2) * Math.hypot(w, 3) / (w * Math.hypot(.8 * w, 2) * Math.hypot(w, 10) * Math.hypot(w, 50));
  const w = bisect(w => magnitude(w) - 1, 1, 20);
  close(w, 8.2000776, 1e-6);
  close(180 + phase(w) * 180 / Math.PI, 114.4875655, 1e-6);
  assert.ok(Math.abs(w - 12.5) > 4);
});

test('202605 Jury absolute condition, correct line correspondence and ramp limit agree with delayed plant', () => {
  const q = question(202605);
  assert.ok(q.answer.includes('KT'));
  assert.ok(q.explanation.includes('D(-1)=2+KT'));
  assert.ok(q.notes.includes('绝对值'));
  assert.notEqual(q.errataLevel, 'ok');
  for (const q of [-2, -.1, .01, .2, .5, .9, 1.01, 2]) {
    const jury = Math.abs(q) < 1 && q > 0 && 2 + q > 0;
    assert.equal(quadraticStable(-1, q), jury);
  }
  const K = .5, T = .2;
  let y = 0, previousInput = 0;
  for (let n = 0; n < 5000; n++) {
    const input = n * T - y;
    y += K * T * previousInput;
    previousInput = input;
  }
  close(5000 * T - y, 1 / K, 1e-8);
});

test('202505 rounded numerator/denominator agree and coefficient rounding changes the Jury bound', () => {
  const q = question(202505);
  assert.ok(q.answer.includes('K(0.005z+0.0045)'));
  assert.ok(q.notes.includes('舍入'));
  const exact = Math.exp(-.1), rounded = .905;
  close(rounded - .9, .005);
  close(1 - 1.1 * rounded, .0045);
  close((1 - rounded) / (1 - 1.1 * rounded), 190 / 9);
  close((1 - exact) / (1 - 1.1 * exact), 20.3389256099, 1e-8);
  assert.equal(quadraticStable((rounded - .9) * 21 - 1 - rounded, rounded + (1 - 1.1 * rounded) * 21), true);
  assert.equal(quadraticStable((exact - .9) * 21 - 1 - exact, exact + (1 - 1.1 * exact) * 21), false);
});

test('202502 dominant first-order settling is approximate; exact normalized output crosses 95% later', () => {
  const q = question(202502);
  assert.ok(q.notes.includes('4.12790'));
  assert.ok(q.notes.includes('近似'));
  assert.equal(q.errataLevel, 'severe');
  const root = Math.sqrt(5), slow = 3 - root, fast = 3 + root;
  const error = t => (fast * Math.exp(-slow * t) - slow * Math.exp(-fast * t)) / (2 * root);
  close(error(0), 1);
  const approximate = 3 / slow, exact = bisect(t => error(t) - .05, 0, 10);
  close(approximate, 3.9270509831248424);
  close(exact, 4.127902579255095, 1e-7);
  assert.ok(error(approximate) > .05);
});

test('202305 symbolic T coefficients reproduce exact sampled continuous step differences', () => {
  const q = question(202305);
  assert.ok(q.explanation.includes('b=T/2'));
  assert.ok(q.explanation.includes('不能唯一'));
  for (const T of [.1, .5, 1, 1.3]) {
    const a = Math.exp(-2 * T), b = T / 2 - (1 - a) / 4, d = (1 - a) / 4 - T * a / 2;
    const step = n => n * T / 2 - (1 - Math.exp(-2 * n * T)) / 4;
    close(b, step(1));
    close((1 + a) * b + d, step(2) - step(1));
  }
});

test('202602 an origin pole in H alone is insufficient without closed-loop stability', () => {
  const q = question(202602);
  assert.ok(q.explanation.includes('0<K<198'));
  assert.ok(q.notes.includes('经验式'));
  const K = (11 / 1.4) ** 2 - 18;
  assert.ok(routh([1, 11, 18, K]).every(v => v > 0));
  assert.ok(routh([1, 11, 18, 5 * K]).some(v => v < 0));
  assert.ok(routh([1, 11, 18, -K]).some(v => v < 0));
  close(3 / 5.5, .5454545454545454);
});

test('202606 self-oscillation statements explicitly assume negative feedback, positive M and harmonic approximation', () => {
  const q = question(202606);
  assert.ok(q.answer.includes('单位负反馈'));
  assert.ok(q.answer.includes('M>0'));
  assert.ok(q.notes.includes('未画'));
  const w = Math.sqrt(11);
  close(15 / (6 - 6 * w * w), -.25);
  close(w * (11 - w * w), 0);
  for (const M of [.1, 1, 3]) {
    const amplitude = 2 * M / Math.PI;
    close(4 * M / (Math.PI * amplitude) + 2, 4);
  }
  assert.ok(routh([1, 6, 11, 6 + 15 * 3]).every(v => v > 0));
  assert.ok(routh([1, 6, 11, 6 + 15 * 5]).some(v => v < 0));
});

test('all second-batch canonical text matches generated payload, with original images retained', () => {
  for (const id of ids) {
    const q = question(id), generated = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url)));
    for (const field of ['answer', 'explanation', 'notes']) {
      assert.equal(generated[field], q[field]);
      for (const c of q[field]) assert.ok(c >= ' ' || c === '\n' || c === '\t');
    }
    assert.deepEqual(generated.originalImages.map(img => img.src), q.answerImages);
  }
});

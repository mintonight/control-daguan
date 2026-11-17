import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const question = id => {
  const year = Math.floor(id / 100), no = id % 100;
  return JSON.parse(readFileSync(new URL(`../data-src/${year}/questions.json`, import.meta.url))).questions.find(q => q.no === no);
};
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const mul = (a, b) => {
  const p = Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) p[i + j] += a[i] * b[j];
  return p;
};
const add = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
const samePolynomial = (a, b) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => close(v, b[i]));
};
function routhFirstColumn(descending) {
  const n = descending.length, width = Math.ceil(n / 2);
  const table = Array.from({ length: n }, () => Array(width).fill(0));
  for (let j = 0; j < width; j++) {
    table[0][j] = descending[2 * j] ?? 0;
    table[1][j] = descending[2 * j + 1] ?? 0;
  }
  for (let i = 2; i < n; i++) for (let j = 0; j < width - 1; j++) {
    assert.notEqual(table[i - 1][0], 0);
    table[i][j] = (table[i - 1][0] * table[i - 2][j + 1] - table[i - 2][0] * table[i - 1][j + 1]) / table[i - 1][0];
  }
  return table.map(row => row[0]);
}
function crossover(magnitude) {
  let low = 1e-5, high = 1e3;
  for (let i = 0; i < 100; i++) {
    const mid = Math.sqrt(low * high);
    if (magnitude(mid) > 1) low = mid;
    else high = mid;
  }
  return Math.sqrt(low * high);
}

test('201705 published formula matches actual 3/10/20 slope changes and stable negative-feedback characteristic', () => {
  const q = question(201705);
  const match = q.answer.match(/G_d\(s\)=\\dfrac\{(\d+)\(1\+s\/(\d+)\)\}\{s\^2\(1\+s\/(\d+)\)\(1\+s\/(\d+)\)\}/);
  assert.ok(match, 'Gd must state its gain, zero and both poles explicitly');
  const [gain, zero, pole1, pole2] = match.slice(1).map(Number);
  assert.deepEqual([[zero, 20], [pole1, -20], [pole2, -20]], [[3, 20], [10, -20], [20, -20]]);
  close(gain, 16);
  const numerator = [gain, gain / zero];
  const denominator = mul([0, 0, 1], mul([1, 1 / pole1], [1, 1 / pole2]));
  const corrected = add(denominator, numerator);
  const before = routhFirstColumn([.1, 1, 0, 16]);
  assert.deepEqual(before.map(Math.sign), [1, 1, -1, 1]);
  assert.equal(before.slice(1).filter((v, i) => Math.sign(v) !== Math.sign(before[i])).length, 2);
  assert.ok(routhFirstColumn([...corrected].reverse()).every(v => v > 0));
  const compensation = q.answer.match(/G_c\(s\)=\\dfrac\{1\+s\/(\d+)\}\{1\+s\/(\d+)\}/);
  assert.ok(compensation);
  const [cz, cp] = compensation.slice(1).map(Number);
  samePolynomial(mul([16], mul([1, 1 / cz], denominator)), mul(numerator, mul([0, 0, 1, .1], [1, 1 / cp])));
  const w = crossover(w => gain * Math.hypot(1, w / zero) / (w * w * Math.hypot(1, w / pole1) * Math.hypot(1, w / pole2)));
  const pm = (Math.atan(w / zero) - Math.atan(w / pole1) - Math.atan(w / pole2)) * 180 / Math.PI;
  close(w, 5.2568672450510805, 1e-9);
  close(pm, 17.830354895051528, 1e-9);
  assert.equal(q.errataLevel, 'ok');
  assert.ok(q.notes.includes('撤回'));
  assert.ok(q.explanation.includes('两次变号'));
  assert.doesNotMatch(q.answer + q.explanation, /斜坡.*仍为 0|闭环仍.*不稳定|题图本身/);
});

test('201706 exact logistic solution has the stated equilibria, local signs, basin and finite escape', () => {
  const q = question(201706), text = q.answer + q.explanation;
  assert.ok(q.notes.includes('1+a(e^t-1)'));
  assert.ok(text.includes('相曲线'));
  assert.ok(q.notes.includes('箭头方向正确'));
  assert.doesNotMatch(text, /吸引域为空/);
  const solution = (a, t) => a * Math.exp(t) / (1 + a * Math.expm1(t));
  for (const a of [-10, -1, -.1, 0, .1, .5, 1, 2, 10]) {
    close(solution(a, 0), a);
    const escape = a < 0 ? Math.log(1 - 1 / a) : Infinity;
    for (const t of [0, .01, .1, .4].filter(t => t < escape)) {
      const x = solution(a, t), den = 1 + a * Math.expm1(t);
      const derivative = a * Math.exp(t) * (1 - a) / (den * den);
      close(derivative, x - x * x, 1e-8);
      if (a < 0 || a > 1) assert.ok(derivative < 0);
      if (a > 0 && a < 1) assert.ok(derivative > 0);
    }
    if (a > 0) close(solution(a, 40), 1);
    if (a === 0) close(solution(a, 40), 0);
    if (a < 0) {
      close(1 + a * Math.expm1(escape), 0);
      assert.ok(solution(a, escape - 1e-7) < -1e6);
    }
  }
  assert.equal(1 - 2 * 0, 1);
  assert.equal(1 - 2 * 1, -1);
});

test('202105 full step sequence agrees with exact held-input plant integration and closed form for n>=0', () => {
  const q = question(202105), text = q.answer + q.explanation;
  assert.ok(text.includes('a=e^{-1}'));
  assert.ok(text.includes('c_n=c_{n-1}-(1-a)c_{n-2}+(1-a)'));
  assert.ok(text.includes('\\cos(n\\theta)'));
  assert.ok(text.includes('\\sin(n\\theta)'));
  const a = Math.exp(-1), rho = Math.sqrt(1 - a), theta = Math.acos(1 / (2 * rho));
  const b = (.5 - a) / Math.sqrt(.75 - a);
  const closedForm = n => 1 - rho ** n * (Math.cos(n * theta) + b * Math.sin(n * theta));
  const sequence = [0, a];
  for (let n = 2; n <= 200; n++) sequence.push(sequence[n - 1] - (1 - a) * sequence[n - 2] + 1 - a);
  let y = 0, velocity = 0;
  for (let n = 0; n <= 200; n++) {
    close(sequence[n], y, 1e-12);
    close(closedForm(n), y, 1e-12);
    const heldInput = 1 - y;
    const nextY = y + (1 - a) * velocity / 2 + a * heldInput;
    velocity = a * velocity + 2 * (1 - a) * heldInput;
    y = nextY;
  }
  close(sequence[2], 1);
  close(sequence[3], 1.3995764008937281);
  const rounded = [0, .37];
  for (let n = 2; n <= 3; n++) rounded.push(rounded[n - 1] - .63 * rounded[n - 2] + .63);
  close(rounded[2], 1); close(rounded[3], 1.3969);
  assert.notEqual(q.errataLevel, 'ok');
});

test('201905 distinguishes the exact crossover from the Bode asymptote crossing', () => {
  const q = question(201905);
  assert.ok(q.answer.includes('6.12'));
  const w = crossover(w => 100 * Math.hypot(1, .612 * w) / (w * Math.hypot(1, w) * Math.hypot(10, w) * Math.hypot(1, .044 * w)));
  close(w, 5.386646748591037, 1e-9);
  const approximateCrossing = 10 * .612;
  assert.ok(approximateCrossing > 1 / .612 && approximateCrossing < 10);
  close(10 * (.612 * approximateCrossing) / approximateCrossing ** 2, 1);
  assert.ok(Math.abs(approximateCrossing - w) > .7);
});

test('201902 identifies the omitted gain without falsely claiming the original displayed a wrong numerator', () => {
  const q = question(201902);
  assert.ok(q.notes.includes('未补全'));
  const c = 10, gain = 2 * c, sum = c + 2, product = 2 * c + 2;
  close(product / gain, 1.1);
  samePolynomial(mul([2, 2, 1], [c, 1]), [gain, product, sum, 1]);
  close((6 + Math.sqrt(14)) * (6 - Math.sqrt(14)), product);
});

test('202306 both harmonic-balance roots are above the dead zone and the small root is not exactly its boundary', () => {
  const q = question(202306);
  assert.ok(q.answer.includes('0.5004'));
  assert.ok(Math.abs(.5004-.5003865756611343)<.00005);
  assert.ok(q.explanation.includes('描述函数'));
  const M = 2, h = .5, k = 10, squared = (2 * M * k / Math.PI) ** 2;
  const largeSquared = (squared + Math.sqrt(squared ** 2 - 4 * squared * h ** 2)) / 2;
  const amplitudes = [Math.sqrt(largeSquared), Math.sqrt(squared * h * h / largeSquared)];
  for (const amplitude of amplitudes) {
    assert.ok(amplitude > h);
    const describing = 4 * M / (Math.PI * amplitude) * Math.sqrt(1 - (h / amplitude) ** 2);
    close(describing * k / 2, 1, 1e-10);
  }
  close(amplitudes[0], 12.722558984050284, 1e-9);
  close(amplitudes[1], .5003865756611343, 1e-9);
  close(4 * M / (Math.PI * h * Math.SQRT2) * Math.sqrt(.5), 2 * M / (Math.PI * h));
});


test('all six corrected source answers match generated text and contain no accidental control characters', () => {
  for (const id of [201705, 201706, 201902, 201905, 202105, 202306]) {
    const source = question(id);
    const generated = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url)));
    for (const field of ['answer', 'explanation', 'notes']) {
      assert.equal(source[field], generated[field]);
      for (const character of source[field]) assert.ok(character >= ' ' || character === '\n' || character === '\t');
    }
    assert.deepEqual(generated.originalImages.map(img => img.src), source.answerImages);
  }
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ids = [201604, 201608, 201702, 202108, 202202];
const source = id => JSON.parse(readFileSync(new URL(`../data-src/${Math.floor(id / 100)}/questions.json`, import.meta.url))).questions.find(q => q.no === id % 100);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const matrices = text => [...text.matchAll(/\\begin\{bmatrix\}([^]*?)\\end\{bmatrix\}/g)].map(m => m[1].split('\\\\').map(row => row.split('&').map(Number)));
const named = (text, name) => {
  const tail = text.split(`${name}=\\begin{bmatrix}`)[1];
  assert.ok(tail, `missing published ${name}`);
  return matrices(`\\begin{bmatrix}${tail}`)[0];
};
const mm = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0)));
const minus = (a, b) => a.map((row, i) => row.map((x, j) => x - b[i][j]));
const det = a => a.length === 1 ? a[0][0] : a[0].reduce((sum, x, j) => sum + (-1) ** j * x * det(a.slice(1).map(row => row.filter((_, k) => k !== j))), 0);
const eyeMinus = (a, s) => a.map((row, i) => row.map((x, j) => (i === j ? s : 0) - x));
const inverse = a => {
  const d = det(a);
  return a.map((_, i) => a.map((__, j) => (-1) ** (i + j) * det(a.filter((_, k) => k !== j).map(row => row.filter((_, k) => k !== i))) / d));
};
const tf = (a, b, c, s) => mm(mm(c, inverse(eyeMinus(a, s))), b)[0][0];
const qc = (a, b) => { const ab = mm(a, b), aab = mm(a, ab); return b.map((row, i) => [row[0], ab[i][0], aab[i][0]]); };
const qo = (a, c) => [c[0], mm(c, a)[0], mm(mm(c, a), a)[0]];
const div = (a, b) => [(a[0] * b[0] + a[1] * b[1]) / (b[0] ** 2 + b[1] ** 2), (a[1] * b[0] - a[0] * b[1]) / (b[0] ** 2 + b[1] ** 2)];
const times = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
function winding(T, gain) {
  const n = 2500, eps = 1e-4, R = 1e4, points = [];
  for (let i = 0; i <= n; i++) points.push([0, -R * (eps / R) ** (i / n)]);
  for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + Math.PI * i / n; points.push([eps * Math.cos(t), eps * Math.sin(t)]); }
  for (let i = 0; i <= n; i++) points.push([0, eps * (R / eps) ** (i / n)]);
  for (let i = 0; i <= n; i++) { const t = Math.PI / 2 - Math.PI * i / n; points.push([R * Math.cos(t), R * Math.sin(t)]); }
  let previous, total = 0;
  for (const s of points) {
    const g = div([gain * (T * s[0] + 1), gain * T * s[1]], times(s, [s[0] - 1, s[1]]));
    const angle = Math.atan2(g[1], 1 + g[0]);
    if (previous !== undefined) total += Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
    previous = angle;
  }
  return total / (2 * Math.PI);
}

test('201604 published critical T agrees with actual stem, imaginary crossing, Routh and indented Nyquist winding', () => {
  const q = source(201604);
  const gain = Number(q.stem.match(/G\(s\)=\\frac\{(\d+)\(Ts\+1\)\}/)?.[1]);
  const critical = Number(q.answer.match(/T_\{\\mathrm\{crit\}\}=(\d*\.\d+)/)?.[1]);
  assert.ok(Number.isFinite(gain) && Number.isFinite(critical));
  close(critical, 1 / gain);
  for (const T of [.05, .1, .2, 1, 3]) {
    const w = 1 / Math.sqrt(T), g = div([gain, gain * T * w], [-w * w, -w]);
    close(g[0], -gain * T); close(g[1], 0);
    assert.equal(gain * T - 1 > 0, T > critical);
  }
  close(winding(.05, gain), -1, 1e-7);
  close(winding(.2, gain), 1, 1e-7);
  assert.ok(q.explanation.includes('原点极点'));
  assert.ok(q.answer.includes('T>0.1'));
  assert.ok(q.explanation.includes('BIBO'));
});

test('201608 actual source matrices, published feedback and full-state poles distinguish hidden instability from BIBO', () => {
  const q = source(201608), [A, B, C] = matrices(q.stem), K = named(q.answer, 'K');
  const F = minus(A, mm(B, K));
  assert.deepEqual(F, named(q.explanation, 'A_f'));
  close(det(qc(A, B)), -5); close(det(qo(A, C)), 0);
  assert.deepEqual(mm(A, [[0], [0], [1]]), [[0], [0], [1]]);
  for (const s of [.2, .7, 2, 5]) {
    close(tf(A, B, C, s), s / (s * s + 2 * s + 2));
    close(det(eyeMinus(F, s)), (s + 5) * (s * s + 2 * s + 2));
  }
  const bad = minus(A, mm(B, [[-2, 1, 5]]));
  close(det(eyeMinus(bad, 2)), 2 ** 3 + 7 * 2 ** 2 + 7 * 2 + 10);
  assert.notEqual(det(eyeMinus(bad, 2)), det(eyeMinus(F, 2)));
  assert.ok(q.answer.includes('BIBO 稳定'));
});

test('201702 arbitrary-initial-condition solution satisfies the actual ODE and exposes the uncontrollable unstable mode', () => {
  const q = source(201702), A = named(q.explanation, 'A_i'), B = named(q.explanation, 'B_i'), C = named(q.explanation, 'C_i');
  assert.deepEqual(mm(A, B), B.map(row => [-2 * row[0]]));
  assert.deepEqual(mm(A, [[1], [1]]), [[1], [1]]);
  for (const s of [.3, 2, 4]) close(tf(A, B, C, s), 1 / (s + 2));
  for (const [y0, v0] of [[0, .01], [1, 0], [2, -4], [-1, 3]]) {
    const p = (2 * y0 + v0) / 3, m = (y0 - v0) / 3;
    close(p + m, y0); close(p - 2 * m, v0);
    for (const t of [0, .1, 1, 3]) {
      const y = p * Math.exp(t) + m * Math.exp(-2 * t);
      const yd = p * Math.exp(t) - 2 * m * Math.exp(-2 * t);
      const ydd = p * Math.exp(t) + 4 * m * Math.exp(-2 * t);
      close(ydd + yd - 2 * y, 0, 1e-8);
    }
  }
  assert.ok((Math.exp(10) - Math.exp(-20)) / 300 > 1);
  assert.ok(q.answer.includes('BIBO 稳定'));
  assert.ok(q.answer.includes('内部不稳定'));
});

test('202108 published open-plant canonical realization and gain meet the actual transfer and all three assigned poles', () => {
  const q = source(202108), A = named(q.answer, 'A'), B = named(q.answer, 'B'), C = named(q.answer, 'C'), K = named(q.answer, 'K');
  const F = minus(A, mm(B, K));
  close(det(qc(A, B)), -1); close(det(qc(F, B)), -1);
  assert.notEqual(det(qo(A, C)), 0); close(det(qo(F, C)), 0);
  assert.deepEqual(qo(F, C).slice(0, 2), [[4, 4, 0], [0, 4, 4]]);
  for (const s of [.1, .5, 1, 4]) {
    close(tf(A, B, C, s), 4 * (s + 1) / (s * s * (s + 2)));
    close(det(eyeMinus(F, s)), (s + 1) * (s + 2) * (s + 3));
    close(tf(F, B, C, s), 4 / ((s + 2) * (s + 3)));
  }
});

test('202108 original k is valid in its own outer-loop/coordinate convention, not interchangeable with canonical open-plant k', () => {
  const q = source(202108), T = named(q.explanation, 'T'), As = named(q.explanation, 'A_s'), Ks = named(q.explanation, 'K_s');
  const A = named(q.answer, 'A'), B = named(q.answer, 'B'), C = named(q.answer, 'C'), K = named(q.answer, 'K');
  const Bp = [[0], [0], [1]], Cp = [[1, 0, 0]], F = minus(A, mm(B, K));
  assert.deepEqual(mm(mm(inverse(T), minus(As, mm(Bp, Ks))), T), F);
  assert.deepEqual(mm(Ks.map((r, i) => r.map((x, j) => x + Cp[i][j])), T), K);
  assert.notEqual(det(eyeMinus(minus(A, mm(B, Ks)), 2)), det(eyeMinus(F, 2)));
  assert.ok(q.notes.includes('自洽'));
  assert.ok(q.explanation.includes('既有单位负反馈'));
  assert.deepEqual(C, [[4, 4, 0]]);
});

test('202108 original graph input and state definitions exactly match canonical total and added feedback, so its status is checked', () => {
  const q = source(202108), text = q.explanation;
  const A = named(q.answer, 'A'), B = named(q.answer, 'B'), C = named(q.answer, 'C'), K = named(q.answer, 'K');
  const As = named(text, 'A_s'), Bp = named(text, 'B_p'), Cp = named(text, 'C_p'), Ks = named(text, 'K_s'), T = named(text, 'T');
  const plus = (a, b) => a.map((row, i) => row.map((x, j) => x + b[i][j]));
  const F = minus(A, mm(B, K)), Fs = minus(As, mm(Bp, Ks)), Ap = plus(As, mm(Bp, Cp));
  assert.deepEqual(As, [[-2, 4, 4], [0, 0, 1], [-1, 0, 0]]);
  assert.deepEqual(mm(mm(inverse(T), Ap), T), A);
  assert.deepEqual(mm(mm(inverse(T), As), T), minus(A, mm(B, C)));
  assert.deepEqual(mm(inverse(T), Bp), B); assert.deepEqual(mm(Cp, T), C);
  assert.deepEqual(mm(Ks, T), minus(K, C)); assert.deepEqual(mm(plus(Cp, Ks), T), K);
  assert.deepEqual(mm(mm(inverse(T), Fs), T), F);
  for (const s of [.1, .5, 1, 4]) {
    const plant = tf(Ap, Bp, Cp, s);
    close(tf(As, Bp, Cp, s), plant / (1 + plant));
    close(tf(Fs, Bp, Cp, s), tf(F, B, C, s));
    close(det(eyeMinus(Fs, s)), (s + 1) * (s + 2) * (s + 3));
  }
  for (const x of [[[0], [1], [-2]], [[2], [-1], [3]], [[.2], [.7], [-.4]]]) for (const v of [0, 1, -2]) {
    const xp = mm(T, x), us = v - mm(Ks, xp)[0][0];
    const sourceDerivative = plus(mm(As, xp), Bp.map(row => [row[0] * us]));
    const canonicalDerivative = mm(T, plus(mm(F, x), B.map(row => [row[0] * v])));
    sourceDerivative.forEach((row, i) => close(row[0], canonicalDerivative[i][0]));
  }
  assert.equal(q.errataLevel, 'ok', 'a valid original convention must not retain a false severe label');
  assert.ok(q.notes.includes('已核对') && q.notes.includes('撤回'));
});

test('202202 published numerical open transfer simultaneously reproduces final error, 30% overshoot and first 0-100% rise at 1s', () => {
  const q = source(202202);
  const match = q.answer.match(/G\(s\)\\approx\\dfrac\{([\d.]+)\}\{s\^2\+([\d.]+)s\+([\d.]+)\}/);
  assert.ok(match, 'missing corrected numerical transfer');
  const [, n, a, b] = match.map(Number), wn = Math.sqrt(b + n), zeta = a / (2 * wn), wd = Math.sqrt(wn * wn - a * a / 4), final = n / (b + n);
  close(1 - final, .2, 2e-8);
  close(Math.exp(-Math.PI * zeta / Math.sqrt(1 - zeta * zeta)), .3, 2e-8);
  const rise = (Math.PI - Math.acos(zeta)) / wd;
  close(rise, 1, 2e-8);
  const y = t => final * (1 - Math.exp(-a * t / 2) * (Math.cos(wd * t) + a / (2 * wd) * Math.sin(wd * t)));
  close(y(1), .8, 2e-8); close(y(Math.PI / wd), 1.04, 2e-8);
  for (const t of [.01, .2, .5, .9]) assert.ok(y(t) < final);
  close(1 / (1 + n / b), .2, 2e-8);
  const oldNumerator = 4.318, oldDenominatorAtZero = 0;
  assert.notEqual(oldDenominatorAtZero / (oldDenominatorAtZero + oldNumerator), .2);
  assert.ok(q.explanation.includes('单位负反馈'));
  assert.ok(q.explanation.includes('0–100%'));
});

test('five completed questions retain correct original-check status, detailed text and source/generated equality', () => {
  for (const id of ids) {
    const q = source(id), p = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url)));
    assert.ok(q.answer.length > 80 && q.explanation.length > 300);
    assert.equal(q.errataLevel, id === 202108 ? 'ok' : 'severe');
    assert.ok(q.notes.includes('文字'));
    for (const field of ['answer', 'explanation', 'notes']) {
      assert.equal(q[field], p[field]);
      for (const c of q[field]) assert.ok(c >= ' ' || c === '\n' || c === '\t');
    }
    assert.deepEqual(p.originalImages.map(i => i.src), q.answerImages);
  }
});

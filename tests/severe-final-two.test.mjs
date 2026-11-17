import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const q = id => JSON.parse(readFileSync(new URL(`../data-src/${Math.floor(id / 100)}/questions.json`, import.meta.url))).questions.find(row => row.no === id % 100);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const inverse2 = a => { const d = a[0][0] * a[1][1] - a[0][1] * a[1][0]; return [[a[1][1] / d, -a[0][1] / d], [-a[1][0] / d, a[0][0] / d]]; };
const mm = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0)));
const stateTf = (a, b, c, s) => mm(mm(c, inverse2(a.map((row, i) => row.map((x, j) => (i === j ? s : 0) - x)))), b)[0][0];
const readNumber = (text, regex) => { const match = text.match(regex); assert.ok(match, `missing published number: ${regex}`); return Number(match[1]); };
const routh = c => {
  const n = c.length, w = Math.ceil(n / 2), a = Array.from({ length: n }, () => Array(w).fill(0));
  for (let j = 0; j < w; j++) { a[0][j] = c[2 * j] ?? 0; a[1][j] = c[2 * j + 1] ?? 0; }
  for (let i = 2; i < n; i++) for (let j = 0; j < w - 1; j++) a[i][j] = (a[i - 1][0] * a[i - 2][j + 1] - a[i - 2][0] * a[i - 1][j + 1]) / a[i - 1][0];
  return a.map(row => row[0]);
};
const bisect = f => { let low = .00001, high = 100; for (let i = 0; i < 100; i++) { const mid = (low + high) / 2; if (f(mid) > 0) low = mid; else high = mid; } return (low + high) / 2; };
const gain = (w, z, p, k = 1) => k * (1 + (z * w) ** 2) / ((1 + (p * w) ** 2) * w * w * Math.hypot(1, w));
const margin = (w, z, p) => (-Math.atan(w) + 2 * Math.atan(z * w) - 2 * Math.atan(p * w)) * 180 / Math.PI;

test('202502 signal sums, equivalent state model and Mason agree with K=Td=2, not original K=1', () => {
  const row = q(202502), K = readNumber(row.answer, /K=T_d=(\d+)/), T = K;
  const A = [[-K-T,K+T],[1,-2]], B = [[K],[0]], C = [[0,1]];
  for (const signal of ['sX=KE-T_dV','V=X-C','(s+1)C=V']) assert.ok(row.explanation.includes(signal));
  close(K + T, 2 ** 2); close(T / (K + T), .5);
  assert.notEqual(2 / (1 + 2), .5);
  for (const s of [.2, .8, 2, 7]) {
    const den = s * s + (2 + K + T) * s + K + T;
    close(stateTf(A, B, C, s), K / den);
    close(1 + stateTf(A, B, [[-1, 1]], s), (s * s + (T + 2) * s + T) / den);
  }
  for (const k of [.7, 2, 5]) for (const t of [.4, 2, 3]) for (const s of [.3, 1, 4]) {
    // Eliminate V=X-C and C=V/(s+1), independently of the rational simplification.
    const v = k / (s * (1 + 1 / (s + 1)) + k + t), c = v / (s + 1), e = 1 - v;
    const delta = 1 + k / s + t / s + 1 / (s + 1);
    close(c, k / (s * (s + 1)) / delta);
    close(e, (1 + t / s + 1 / (s + 1)) / delta);
    close(s * (v + c), k * e - t * v);
  }
  assert.ok(row.explanation.includes('C(s)=Y(s)'));
  assert.ok(row.explanation.includes('E=R-V'));
});

test('202502 independent exact output bands remain distinct from the learner-facing dominant-pole approximation', () => {
  const row = q(202502), K = readNumber(row.answer, /K=T_d=(\d+)/), A = [[-2*K,2*K],[1,-2]], B = [[K],[0]];
  const steady = mm(inverse2(A), B).map(r => [-r[0]]), root = Math.sqrt(5), a = 3 - root, b = 3 + root;
  close(steady[1][0], .5);
  const rho = t => (b * Math.exp(-a * t) - a * Math.exp(-b * t)) / (b - a);
  for (const [percent, delta] of [[5, .05], [2, .02]]) {
    const time = bisect(t => rho(t) - delta);
    close(time, percent === 5 ? 4.127902579255095 : 5.32734272, 1e-8);
    close(rho(time), delta, 1e-8);
    assert.ok(rho(time - .001) > delta && rho(time + .001) < delta);
    const expA = A.map((r, i) => r.map((x, j) => Math.exp(-3 * time) * ((i === j ? Math.cosh(root * time) : 0) + Math.sinh(root * time) / root * (x + (i === j ? 3 : 0)))));
    const residual = mm(expA, steady);
    close(residual[1][0] / steady[1][0], delta, 1e-8);
  }
  assert.ok(rho(3 / a) > .05);
  for (const t of [.1, 1, 4, 10]) assert.ok(-a * b / (b - a) * (Math.exp(-a * t) - Math.exp(-b * t)) < 0);
  assert.ok(row.explanation.includes('工程'));
  assert.ok(row.answer.includes('3.93'));
  assert.ok(row.notes.includes('4.13'));
});

test('202604 exact Bode crossings differ from asymptote 1 and added integrator makes the uncompensated loop unstable', () => {
  const row = q(202604), w0 = readNumber(row.answer, /\\omega_\{cb\}\\approx([\d.]+)/), wi = readNumber(row.answer, /\\omega_\{ci\}\\approx([\d.]+)/);
  close(w0, Math.sqrt((Math.sqrt(5)-1)/2), .0005);
  const exactWi=bisect(w=>1/(w*w*Math.hypot(1,w))-1);close(wi,exactWi,.0005);
  const pb = readNumber(row.answer, /\\gamma_b\\approx([\d.]+)/), pi = readNumber(row.answer, /\\gamma_i\\approx(-?[\d.]+)/);
  close(pb, 90 - Math.atan(w0) * 180 / Math.PI, .05); close(pi, -Math.atan(wi) * 180 / Math.PI, .05);
  close(-10 * Math.log10(2), -3.010299956639812);
  assert.ok(routh([1, 1, 1]).every(v => v > 0));
  const signs = routh([1, 1, 0, 1]); assert.equal(signs.slice(1).filter((v, i) => v * signs[i] < 0).length, 2);
  assert.ok(row.explanation.includes('稳定前提'));
});

test('202604 published two-stage proper lead has a unique unity crossing, >=40 degree phase margin and stable fifth-order closed loop', () => {
  const row = q(202604), z = readNumber(row.answer, /T_z=([\d.]+)/), p = 1/readNumber(row.answer, /T_p=\\frac\{1\}\{(\d+)\}/);
  close(z, 1.5);close(p,1/6);
  const crossing=bisect(w=>gain(w,z,p)-1);close(gain(crossing,z,p),1);
  const pm = margin(crossing,z,p), reported = readNumber(row.answer, /\\gamma_c\\approx([\d.]+)/);
  close(crossing,2.0103717365739517);close(pm,42.7061599505346);close(pm,reported,.05);assert.ok(pm>=40);
  const characteristic = [p * p, p * p + 2 * p, 1 + 2 * p, 1 + z * z, 2 * z, 1];
  assert.ok(routh(characteristic).every(v => v > 0));
  for (const w of [.01, .1, 1, 2, 10, 100]) {
    const logDerivative = -2 - w * w / (1 + w * w) + 2 * ((z * w) ** 2 / (1 + (z * w) ** 2) - (p * w) ** 2 / (1 + (p * w) ** 2));
    assert.ok(logDerivative < 0);
  }
  assert.ok(p > 0 && z > p);
});

test('202604 original numeric compensator fails both phase-margin and full closed-loop stability requirements', () => {
  const w = bisect(x => Math.hypot(1, 2.34 * x) / (x * x * Math.hypot(1, x) * Math.hypot(1, .31 * x)) - 1);
  const pm = (-Math.atan(w) + Math.atan(2.34 * w) - Math.atan(.31 * w)) * 180 / Math.PI;
  close(w, 1.34877603224453, 1e-9); close(pm, -3.7175396582321447, 1e-9);
  assert.ok(pm < 0 && pm < 40);
  const signs = routh([.31, 1.31, 1, 2.34, 1]); assert.equal(signs.slice(1).filter((v, i) => v * signs[i] < 0).length, 2);
});

test('both final severe answers contain complete source-matched text and retain original figures', () => {
  for (const id of [202502, 202604]) {
    const row = q(id), generated = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url)));
    assert.ok(row.answer.length > 300 && row.explanation.length > 800);
    assert.equal(row.errataLevel, 'severe'); assert.ok(row.notes.includes('文字'));
    for (const name of ['answer', 'explanation', 'notes']) {
      assert.equal(row[name], generated[name]);
      for (const c of row[name]) assert.ok(c >= ' ' || c === '\n' || c === '\t');
    }
    assert.deepEqual(generated.originalImages.map(img => img.src), row.answerImages);
  }
});

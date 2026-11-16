import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = JSON.parse(readFileSync(new URL('../data-src/2023/questions.json', import.meta.url)));
const q = source.questions.find(q => q.no === 2);
const published = JSON.parse(readFileSync(new URL('../public/data/questions/202302.json', import.meta.url)));
const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function parameters() {
  const kt = Number(q.answer.match(/K_t=([\d.]+)/)?.[1]);
  const kd = Number(q.answer.match(/K_d=([\d.]+)/)?.[1]);
  assert.ok(Number.isFinite(kt) && Number.isFinite(kd), 'new independent feedback parameters must be published');
  return { kt, kd };
}

test('202302 new two-feedback diagram and text are published without rewriting the second ask or old scans', () => {
  assert.ok(q.stem.includes('无阻尼振荡频率为 $2\\,\\mathrm{rad/s}$'));
  assert.ok(q.stem.endsWith('2、当 $e_{ss}=0$ 时，求 $G_c(s)$ 的形式。'));
  assert.ok(q.stem.includes('E(s)=R(s)-K_dY(s)'));
  assert.ok(q.stem.includes('K_t$、$K_d'));
  assert.deepEqual(q.answerImages, ['img/a2023-2-1.png', 'img/a2023-2-2.png']);
  assert.ok(q.notes.includes('文字已按用户提供的新图重算'));
  assert.ok(q.notes.includes('不是新图的配套解答'));
  assert.doesNotMatch(q.notes, /题干亦有矛盾|三者不能同时成立|忽略矛盾/);
  for (const key of ['answer', 'explanation', 'notes', 'errataLevel']) assert.equal(q[key], published[key]);
  const image = readFileSync(new URL('../data-src/2023/' + q.figures[0], import.meta.url));
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 1600);
  assert.equal(image.readUInt32BE(20), 640);
  assert.deepEqual(image, readFileSync(new URL('../public/' + q.figures[0], import.meta.url)));
});

test('202302 signal equations independently give both transfer ratios and solve wn/steady-error constraints', () => {
  const { kt, kd } = parameters();
  const wn = Number(q.stem.match(/频率为 \$([\d.]+)/)?.[1]);
  const ess = Number(q.stem.match(/e_\{ss\}=([\d.]+)/)?.[1]);
  const sum = 1.2 * wn ** 2;
  close(kt, ess * sum); close(kd, (1 - ess) * sum);
  close(kt / (kt + kd), ess);
  close(Math.sqrt((kt + kd) / 1.2), wn);
  // Direct elimination from E=R-KdY, U=E/(1.2s+1), sY=U+GcR-KtY.
  for (const s of [0, 0.1, 1, 2, 7, 19]) for (const gc of [0, 2 / 3, (s + kt) / kd]) {
    const block = 1.2 * s + 1;
    const y = (1 / block + gc) / (s + kt + kd / block);
    const e = 1 - kd * y;
    const u = e / block;
    close(s * y, u + gc - kt * y);
    const d = 1.2 * s * s + (1 + 1.2 * kt) * s + kt + kd;
    close(y, (1 + block * gc) / d);
    close(e, (d - kd * (1 + block * gc)) / d);
  }
  // The old ka=.4 with unit outer feedback cannot meet either requested condition.
  assert.ok(Math.abs(0.4 / 1.4 - ess) > 0.1);
  assert.ok(Math.abs(Math.sqrt(1.4 / 1.2) - wn) > 0.9);
});

function bisect(f, a, b) {
  assert.ok(f(a) * f(b) < 0);
  for (let i = 0; i < 80; i++) {
    const mid = (a + b) / 2;
    if (f(a) * f(mid) <= 0) b = mid; else a = mid;
  }
  return (a + b) / 2;
}

test('202302 exact 5% settling is the LAST entry after the slightly-out-of-band peak', () => {
  const { kt, kd } = parameters();
  const wn = Math.sqrt((kt + kd) / 1.2), alpha = (1 + 1.2 * kt) / 2.4;
  const wd = Math.sqrt(wn * wn - alpha * alpha);
  const residual = t => -Math.exp(-alpha * t) * (Math.cos(wd * t) + alpha / wd * Math.sin(wd * t));
  const tp = Math.PI / wd;
  const mp = residual(tp);
  close(100 * mp, 5.073773990658204);
  const textOvershoot = Number(q.answer.match(/\\sigma\\%\\approx([\d.]+)/)?.[1]);
  close(textOvershoot, 100 * mp, 1e-5);
  const ts = bisect(t => residual(t) - 0.05, tp, 2 * tp);
  const first = bisect(t => residual(t) + 0.05, 0, tp);
  assert.ok(first < tp && tp < ts);
  assert.ok(residual(ts - 1e-5) > .05 && residual(ts + 1e-5) < .05);
  // Derivative = wn²/wd * exp(-alpha*t) * sin(wd*t): monotone to next extremum;
  // all subsequent extrema decrease geometrically, hence no later boundary crossing.
  assert.ok(Math.abs(residual(2 * tp)) < .05);
  for (let n = 2; n <= 12; n++) close(Math.abs(residual(n * tp)), mp ** n);
  const textExact = Number(q.answer.match(/t_\{s,\\mathrm\{exact\}\}\\approx([\d.]+)/)?.[1]);
  const textApprox = Number(q.answer.match(/t_\{s,\\mathrm\{approx\}\}\\approx([\d.]+)/)?.[1]);
  close(textExact, ts, 1e-6); close(textApprox, 3 / alpha, 1e-6);
  assert.ok(Math.abs(ts - 3 / alpha) > .07);
  close(1 / (kt + kd), 5 / 24);
  assert.ok(q.explanation.includes('相对于输出终值'));
});

test('202302 zero STEP feedback error needs only DC compensation; full cancellation is stronger', () => {
  const { kt, kd } = parameters();
  const gc0 = Number(q.answer.match(/G_c\(0\)=\\dfrac\{(\d+)\}\{(\d+)\}/)?.[1]) /
    Number(q.answer.match(/G_c\(0\)=\\dfrac\{(\d+)\}\{(\d+)\}/)?.[2]);
  close(1 - kd * (1 + gc0) / (kt + kd), 0);
  close(gc0, kt / kd);
  const outputFinal = (1 + gc0) / (kt + kd);
  close(outputFinal, 1 / kd);
  assert.ok(Math.abs(1 - outputFinal) > .6, 'R-Y is NOT this diagram feedback error');
  // A strictly proper stable alternative with same DC value also meets the step condition.
  for (const s of [.1, 1, 10]) {
    const d = (1.2 * s + 1) * (s + kt) + kd;
    const full = (s + kt) / kd;
    close(1 - kd * (1 + (1.2 * s + 1) * full) / d, 0);
    const constantError = 1 - kd * (1 + (1.2 * s + 1) * gc0) / d;
    assert.ok(Math.abs(constantError) > 1e-4);
  }
  close(1 - kd * (1 + gc0 / (0 + 1)) / (kt + kd), 0);
  assert.ok(q.explanation.includes('并不唯一'));
  assert.ok(q.explanation.includes('理想微分'));
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const rows = new Map();
for (const year of [2020, 2021, 2022]) for (const q of JSON.parse(readFileSync(new URL(`../data-src/${year}/questions.json`, import.meta.url))).questions) rows.set(year * 100 + q.no, q);
const q = id => rows.get(id);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const mm = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0)));
const minus = (a, b) => a.map((row, i) => row.map((v, j) => v - b[i][j]));
function named(text, name) {
  const at = text.indexOf(name + '='); assert.ok(at >= 0, name);
  const begin = text.indexOf('\\begin{bmatrix}', at), end = text.indexOf('\\end{bmatrix}', begin);
  return text.slice(begin + '\\begin{bmatrix}'.length, end).split('\\\\').map(row => row.split('&').map(Number));
}
test('last batch is exactly 23 records: all 23 independent written solutions', () => {
  assert.equal(rows.size, 23);assert.equal([...rows.values()].filter(x => x.answer).length, 23);
  for (const [id, row] of rows) {
    if (!row.answer) {assert.equal(row.explanation, '');assert.ok(row.answerImages.length);continue;}
    for (const field of ['answer', 'explanation']) {
      assert.doesNotMatch(row[field], /原图|原解|原书|答案中的|即上述/);
      assert.ok([...row[field]].every(c => c === '\n' || c.charCodeAt(0) >= 32));
      assert.doesNotMatch(row[field], /\*\*[^*\n]*\$[^*\n]*\*\*/, 'formula headings must render rather than show raw TeX inside bold');
    }
    const generated = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url)));
    for (const f of ['answer', 'explanation', 'notes']) assert.equal(generated[f], row[f] ?? '');
  }
});
test('202104 phase construction independently verifies the peak rather than propagating64.2 degrees', () => {
  const text = q(202104).answer + q(202104).explanation;
  assert.doesNotMatch(text, /64\.2/);assert.ok(text.includes('64.79'));
  assert.ok(text.includes('横轴'));assert.ok(text.includes('最小相位'));
  const phase = w => (Math.atan(50 * w) - Math.atan(2.5 * w)) * 180 / Math.PI;
  const wm = 1 / Math.sqrt(125), peak = phase(wm);
  near(peak, Math.asin(19 / 21) * 180 / Math.PI);near(peak, 64.79123470324164);
  assert.ok(phase(wm * .99) < peak && phase(wm * 1.01) < peak);
  for (const w of [.002, .02, .05, .4, 4]) near(phase(w), phase(1 / (125 * w)));
});
test('202108 added feedback retains the unit outer loop and equals the total feedback model', () => {
  assert.ok(q(202108).explanation.includes('x_1=w'));assert.ok(q(202108).explanation.includes('既有单位负反馈'));
  const A = named(q(202108).answer, 'A'), B = named(q(202108).answer, 'B'), C = named(q(202108).answer, 'C');
  const K = named(q(202108).answer, 'K'), Kh = named(q(202108).answer, 'K_h');
  assert.deepEqual(minus(K, C), Kh);assert.deepEqual(minus(minus(A, mm(B, C)), mm(B, Kh)), minus(A, mm(B, K)));
  assert.equal(q(202108).errataLevel, 'ok');
});
test('202007 complete radial decay follows the nonlinear ODE and proves global attraction', () => {
  assert.ok(q(202007).explanation.includes('V(t)='));
  for (const [x, y] of [[1, 2], [-.3, .5], [0, 0], [100, -1]]) {
    const V = x*x+y*y, dx = y-x*V, dy=-x-y*V;
    near(2*x*dx+2*y*dy, -2*V*V, 1e-5);
    for (const t of [0, .1, 1, 10]) {
      const v = V/(1+2*V*t), dv=-2*V*V/(1+2*V*t)**2;
      near(dv,-2*v*v,1e-5);assert.ok(v>=0 && v<=V);
    }
  }
});
test('202106 finite-amplitude inverse describing function has open endpoints and no harmonic balance', () => {
  const text=q(202106).answer+q(202106).explanation;
  assert.ok(text.includes('(-1,0)'));assert.ok(text.includes('描述函数近似'));
  for (const A of [.001, .1, 1, 100, 1e6]) {
    const N=1+4/(Math.PI*A), inverse=-1/N;
    assert.ok(inverse>-1 && inverse<0 && inverse>-4/3);
    assert.ok((6-8*N)/3<0 && 8*N>0); // Routh signs +,+,-,+:two unstable equivalent linear poles.
  }
});
test('202207 both stated coordinate directions intertwine their actual published state matrices', () => {
  const a=q(202207).answer,A=named(a,'A'),B=named(a,'B'),T=named(a,'T'),P=named(a,'P');
  const barA=named(a,'\\bar A'),barB=named(a,'\\bar B'),tildeA=named(a,'\\tilde A'),tildeB=named(a,'\\tilde B');
  assert.deepEqual(mm(A,T),mm(T,barA));assert.deepEqual(B,mm(T,barB));
  assert.deepEqual(mm(P,A),mm(tildeA,P));assert.deepEqual(mm(P,B),tildeB);
  assert.ok(q(202207).explanation.includes('\\dot{\\bar x}'));
});
test('202101 cascade closure produces the displayed ODE coefficients and negative unity DC gain', () => {
  assert.ok(q(202101).explanation.includes('U_1'));assert.ok(q(202101).explanation.includes('理想运放'));
  for (const [r2,r3,r4,c1,c2] of [[2,3,4,.1,.3],[1,5,2,.7,.2]]) for (const s of [.01,.2,1,5]) {
    const M=r4/(r2*r3*c1*s*(1+r4*c2*s));
    near(-M/(1+M),-r4/(r2*r3*r4*c1*c2*s*s+r2*r3*c1*s+r4));
  }
});

test('completed all-bank coverage reconciles 88 actual records with all 88 written without banning stem figures', () => {
  const counts=[],all=[];
  for(let year=2016;year<=2026;year++) {
    const records=JSON.parse(readFileSync(new URL(`../data-src/${year}/questions.json`,import.meta.url))).questions;
    counts.push(records.length);all.push(...records);
  }
  assert.deepEqual(counts,[8,8,8,9,7,8,8,8,8,8,8]);assert.equal(all.length,88);
  assert.equal(all.filter(r=>r.answer&&r.explanation).length,88);assert.equal(all.filter(r=>!r.answer&&!r.explanation).length,0);
  for(const row of all.filter(r=>r.answer)) for(const field of ['answer','explanation']) assert.doesNotMatch(row[field],/原答案|原解|原书|见原图解析|答案中的|即上述/);
});

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import katex from 'katex';

const allQuestions = new Map();
for (let year = 2016; year <= 2026; year++) {
  const src = JSON.parse(readFileSync(new URL(`../data-src/${year}/questions.json`, import.meta.url), 'utf8'));
  for (const q of src.questions) allQuestions.set(year * 100 + q.no, q);
}
const q = id => allQuestions.get(id);
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test('all 88 questions have complete written answer/explanation, valid KaTeX, and no raw bold-math or scan references', () => {
  assert.equal(allQuestions.size, 88);
  for (const [id, row] of allQuestions) {
    assert.ok(row.answer && row.answer.trim().length > 40, `${id} answer missing or too short`);
    assert.ok(row.explanation && row.explanation.trim().length > 150, `${id} explanation missing or too short`);
    for (const field of ['answer', 'explanation']) {
      const text = row[field];
      for (const m of text.matchAll(/\*\*([^*\n]+)\*\*/g)) {
        assert.ok(!m[1].includes('$'), `${id}.${field} contains TeX inside bold: ${m[0]}`);
      }
      assert.doesNotMatch(text, /原图|原解|原书|原答案|见原图解析|答案中的|即上述/, `${id}.${field} references original scan`);
      // Verify every display $$...$$ and inline $...$ formula parses cleanly with KaTeX
      const stripped = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => {
        katex.renderToString(expr, { displayMode: true, throwOnError: true });
        return '';
      });
      for (const m of stripped.matchAll(/\$([^$\n]+)\$/g)) {
        katex.renderToString(m[1], { displayMode: false, throwOnError: true });
      }
    }
    const pub = JSON.parse(readFileSync(new URL(`../public/data/questions/${id}.json`, import.meta.url), 'utf8'));
    for (const field of ['answer', 'explanation', 'notes']) {
      assert.equal(pub[field], row[field] ?? '', `${id}.${field} drift between data-src and public`);
    }
  }
});

test('all multi-loop signal flow graph questions use Mason gain formula and include SFG figures', () => {
  for (const id of [201602, 201802, 202002, 202102, 202302, 202502, 202602]) {
    const text = q(id).answer + '\n' + q(id).explanation;
    assert.ok(text.includes('梅森公式'), `${id} must use Mason gain formula`);
    assert.ok(text.includes(`img/solution-${id}-sfg.svg`), `${id} must embed SFG diagram`);
  }
  assert.ok(q(202402).explanation.includes('梅森公式'));
});

test('all 19 newly generated SVG solution figures exist in source & public, are referenced, and are safe SVG XML', () => {
  const expected = [
    [201602, 'img/solution-201602-sfg.svg'],
    [201604, 'img/solution-201604-nyquist.svg'],
    [201606, 'img/solution-201606-nyquist.svg'],
    [201706, 'img/solution-201706-phase.svg'],
    [201802, 'img/solution-201802-sfg.svg'],
    [201806, 'img/solution-201806-nyquist.svg'],
    [201906, 'img/solution-201906-nyquist.svg'],
    [202002, 'img/solution-202002-sfg.svg'],
    [202005, 'img/solution-202005-phase.svg'],
    [202102, 'img/solution-202102-sfg.svg'],
    [202106, 'img/solution-202106-nyquist.svg'],
    [202204, 'img/solution-202204-nyquist.svg'],
    [202205, 'img/solution-202205-phase.svg'],
    [202302, 'img/solution-202302-sfg.svg'],
    [202306, 'img/solution-202306-equiv.svg'],
    [202404, 'img/solution-202404-nyquist.svg'],
    [202502, 'img/solution-202502-sfg.svg'],
    [202506, 'img/solution-202506-nyquist.svg'],
    [202602, 'img/solution-202602-sfg.svg'],
  ];
  for (const [id, rel] of expected) {
    const year = Math.floor(id / 100);
    const srcUrl = new URL(`../data-src/${year}/${rel}`, import.meta.url);
    const pubUrl = new URL(`../public/${rel}`, import.meta.url);
    assert.ok(existsSync(srcUrl), `missing source SVG ${rel}`);
    assert.ok(existsSync(pubUrl), `missing public SVG ${rel}`);
    const svg = readFileSync(srcUrl, 'utf8');
    assert.ok(svg.startsWith('<svg ') && svg.trimEnd().endsWith('</svg>'), `${rel} invalid SVG wrapper`);
    assert.doesNotMatch(svg, /<script|<foreignObject/i, `${rel} unsafe element`);
    assert.equal(svg, readFileSync(pubUrl, 'utf8'), `${rel} source/public mismatch`);
    const text = q(id).answer + '\n' + q(id).explanation;
    assert.ok(text.includes(`(${rel})`), `${id} text does not reference ${rel}`);
  }
});

test('mathematical verification of newly written exam-standard solutions', () => {
  // 201602 Mason & metrics
  for (const s of [0.3, 1, 4]) {
    const l1 = -5 / (s + 1), l2 = -20 / (s * (s + 1)), d = 1 - l1 - l2;
    close((20 / (s * (s + 1))) / d, 20 / (s * s + 6 * s + 20));
    close((1 - l1) / d, s * (s + 6) / (s * s + 6 * s + 20));
  }
  close(6 / 20, 0.3);
  close(Math.exp(-3 * Math.PI / Math.sqrt(11)) * 100, 5.8323, 0.001);

  // 201605 lag compensator
  const pm201605 = (Math.atan(4) - Math.atan(0.4) - Math.atan(0.08)) * 180 / Math.PI;
  close(pm201605, 49.59, 0.02);

  // 201704 PI max phase margin
  for (const [tau, ta] of [[4, 1], [9, 2]]) {
    const wc = 1 / Math.sqrt(tau * ta);
    const gmax = Math.atan(tau * wc) - Math.atan(ta * wc);
    close(gmax, Math.asin((tau - ta) / (tau + ta)));
    assert.ok(gmax > Math.atan(tau * wc * 0.9) - Math.atan(ta * wc * 0.9));
    assert.ok(gmax > Math.atan(tau * wc * 1.1) - Math.atan(ta * wc * 1.1));
  }

  // 201802 velocity feedback
  const kl = (1.2 * Math.sqrt(10) - 1) / 10;
  close(kl, 0.279473319, 1e-6);
  close((1 + 10 * kl) / 10, 0.379473319, 1e-6);

  // 202001 op-amp T-network
  for (const s of [0.2, 1, 5]) {
    const [r1, r3, r4, r5, c] = [2, 3, 5, 7, 0.4];
    const u1 = -r3 / r1;
    const z2 = r5 + 1 / (c * s);
    const uo = u1 - r4 * (1 / r1 - u1 / z2);
    const tf = -((r3 * r4 + r3 * r5 + r4 * r5) * c * s + (r3 + r4)) / (r1 * r5 * c * s + r1);
    close(uo, tf);
  }

  // 202002 Mason Q1 & Q2
  close(35 / (5 + 35), 0.875);
  const z20 = -Math.log(0.205) / Math.hypot(Math.PI, Math.log(0.205));
  const wn20 = 75 / (2 * z20);
  close((wn20 * wn20 - 350) / 10, 658.27, 0.05);

  // 202006 & 202107 state transition matrices at t=0 and t=0.5
  for (const t of [0, 0.5]) {
    const e1 = Math.exp(-t), e2 = Math.exp(-2 * t);
    const phi = [[-e1 + 2 * e2, -2 * e1 + 2 * e2], [e1 - e2, 2 * e1 - e2]];
    const dphi = [[e1 - 4 * e2, 2 * e1 - 4 * e2], [-e1 + 2 * e2, -2 * e1 + 2 * e2]];
    // dphi = A * phi where A = [[-3,-2],[1,0]]
    close(dphi[0][0], -3 * phi[0][0] - 2 * phi[1][0]);
    close(dphi[0][1], -3 * phi[0][1] - 2 * phi[1][1]);
    close(dphi[1][0], phi[0][0]);
    close(dphi[1][1], phi[0][1]);
  }
  for (const t of [0, 0.5]) {
    const e2 = Math.exp(-2 * t), e3 = Math.exp(-3 * t);
    const phi = [[3 * e2 - 2 * e3, e2 - e3], [-6 * e2 + 6 * e3, -2 * e2 + 3 * e3]];
    const dphi = [[-6 * e2 + 6 * e3, -2 * e2 + 3 * e3], [12 * e2 - 18 * e3, 4 * e2 - 9 * e3]];
    // dphi = A * phi where A = [[0,1],[-6,-5]]
    close(dphi[0][0], phi[1][0]);
    close(dphi[0][1], phi[1][1]);
    close(dphi[1][0], -6 * phi[0][0] - 5 * phi[1][0]);
    close(dphi[1][1], -6 * phi[0][1] - 5 * phi[1][1]);
  }

  // 202204 Nyquist imaginary crossing and asymptotic margin
  const wc22 = 50 * Math.SQRT2;
  const pm22 = 90 + (Math.atan(10 * wc22) - Math.atan(wc22) - Math.atan(0.02 * wc22)) * 180 / Math.PI;
  close(pm22, 35.99, 0.01);

  // 202606 characteristic equation typo fixed
  assert.doesNotMatch(q(202606).explanation, /s\(s\+1\)\(s\+2\)\(s\+3\)\+15N\(A\)=0/);
  assert.ok(q(202606).explanation.includes('(s+1)(s+2)(s+3)+15N(A)=0'));
});

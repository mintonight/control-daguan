import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = JSON.parse(readFileSync(new URL('../data-src/2023/questions.json', import.meta.url)));
const question = source.questions.find(q => q.no === 1);
const published = JSON.parse(readFileSync(new URL('../public/data/questions/202301.json', import.meta.url)));

test('202301 uses the figure symbols and explains both state scalings accurately', () => {
  for (const q of [question, published]) {
    const text = [q.answer, q.explanation, q.notes].join('\n');
    assert.doesNotMatch(text, /x_0|\\dot x_0|\\frac fm|f\\dot/);
    assert.ok(q.answer.includes('m\\ddot f(t)+C\\dot f(t)+Kf(t)=g(t)'));
    assert.ok(q.answer.includes('\\dfrac{F(s)}{G(s)}=\\dfrac{1}{ms^2+Cs+K}'));
    assert.ok(q.answer.includes('C_y=\\begin{bmatrix}1&0\\end{bmatrix}'));
    assert.ok(q.answer.includes('D=0'));
    assert.ok(q.explanation.includes('静平衡位置'));
    assert.ok(q.explanation.includes('z_1=mf(t)'));
    assert.ok(q.explanation.includes('z_2=m\\dot f(t)'));
    assert.ok(q.notes.includes('A_{12}=0'));
    assert.ok(q.notes.includes('应为 $1$'));
    assert.ok(q.notes.includes('缩放状态'));
    assert.doesNotMatch(text, /若把.*则.*与传递函数也不一致/s);
  }
  assert.ok(question.stem.includes('以静平衡位置为位移零点'));
  assert.deepEqual(question.answerImages, ['img/a2023-1-1.png']);
  for (const field of ['answer', 'explanation', 'notes']) assert.equal(published[field], question[field]);
});

const add = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0n) + (b[i] ?? 0n));
const negate = a => a.map(x => -x);
const multiply = (a, b) => {
  const result = Array(a.length + b.length - 1).fill(0n);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) result[i + j] += a[i] * b[j];
  return result;
};
const trim = a => {
  const result = [...a];
  while (result.length > 1 && result.at(-1) === 0n) result.pop();
  return result;
};

function transfer(m, damping, stiffness, scaled, broken) {
  const a = [0n, m], b = [broken ? 0n : -m], c = [stiffness], d = [damping, m];
  const input = [[0n], [scaled ? m : 1n]];
  const output = [[1n], [0n]];
  const denominator = multiply(add(multiply(a, d), negate(multiply(b, c))), [scaled ? m : 1n]);
  const numerator = add(
    multiply(output[0], add(multiply(d, input[0]), negate(multiply(b, input[1])))),
    multiply(output[1], add(negate(multiply(c, input[0])), multiply(a, input[1])))
  );
  return { numerator, denominator };
}

test('202301 physical and scaled states give exactly 1/(ms²+Cs+K); printed A12=0 gives zero', () => {
  for (const m of [1n, 2n, 7n, 101n]) for (const damping of [0n, 1n, 3n, 29n]) for (const stiffness of [1n, 5n, 47n]) {
    for (const scaled of [false, true]) {
      const { numerator, denominator } = transfer(m, damping, stiffness, scaled, false);
      assert.deepEqual(trim(multiply(numerator, [stiffness, damping, m])), trim(denominator));
      const wrong = transfer(m, damping, stiffness, scaled, true);
      assert.deepEqual(trim(wrong.numerator), [0n]);
      assert.notDeepEqual(trim(wrong.denominator), [0n]);
    }
  }
});

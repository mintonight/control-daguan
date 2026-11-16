// errataPlacement 穷举表测试：全部 1024 种输入组合与 tests/errata-placement.table.tsv 逐行比对。
// 这张表由重构前 app.js 的 showingOrigImages / showingUncorrectedText / errataIn 生成，证明界面行为没变。
// 有意改规则时：UPDATE_TABLE=1 npm test 重写表，再在 diff 里逐行审查。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { errataPlacement } from '../public/src/core/errata.js';
const FILE = new URL('./errata-placement.table.tsv', import.meta.url);
const B = [false, true];
const rows = [];
for (const hasNotes of B) for (const level of ['', 'ok', 'severe', 'conflict']) for (const hasAnswer of B) for (const hasExplanation of B) for (const hasImages of B)
for (const answerOpen of B) for (const expOpen of B) for (const answerView of ['text', 'orig']) for (const expView of ['text', 'orig']) {
  const got = errataPlacement({ hasNotes, level, hasAnswer, hasExplanation, hasImages, answerOpen, expOpen, answerView, expView });
  rows.push([+hasNotes, level || '-', +hasAnswer, +hasExplanation, +hasImages, +answerOpen, +expOpen, answerView, expView, got || '-'].join('\t'));
}

test('穷举 1024 种组合，与表逐行一致', () => {
  if (process.env.UPDATE_TABLE) fs.writeFileSync(FILE, rows.join('\n') + '\n');
  const want = fs.readFileSync(FILE, 'utf8').trimEnd().split('\n');
  assert.equal(rows.length, 1024);
  rows.forEach((r, i) => assert.equal(r, want[i], `第 ${i + 1} 行（列：有勘误 等级 有文字答案 有文字解析 有原图 答案展开 解析展开 答案视图 解析视图 → 位置）`));
});

const base = { hasNotes: true, level: '', hasAnswer: true, hasExplanation: true, hasImages: true, answerOpen: true, expOpen: true, answerView: 'text', expView: 'text' };
test('典型情形', () => {
  assert.equal(errataPlacement(base), null, '文字已改正、都看文字：不显示');
  assert.equal(errataPlacement({ ...base, expView: 'orig' }), 'exp', '切到原图解析：显示在解析框');
  assert.equal(errataPlacement({ ...base, answerView: 'orig' }), 'answer', '只有答案切到原图：显示在答案框');
  assert.equal(errataPlacement({ ...base, answerView: 'orig', expView: 'orig' }), 'exp', '都看原图：只显示一次，优先解析框');
  assert.equal(errataPlacement({ ...base, level: 'severe' }), 'exp', '严重错误：文字版旁也显示');
  assert.equal(errataPlacement({ ...base, hasAnswer: false, hasExplanation: false, expOpen: false }), 'answer', '只有原图：跟着原图显示');
  assert.equal(errataPlacement({ ...base, hasNotes: false, expView: 'orig' }), null, '没有勘误：不显示');
});

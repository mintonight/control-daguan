/* 控制大观 · 勘误放在哪个框里显示（纯函数，无 DOM）。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CDGErrata = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
const UNSAFE = new Set(['severe', 'conflict']);
/**
 * 勘误说的是原图里的内容，所以跟着原图出现；文字版已改正时不显示。
 * 例外：严重错误 / 题目矛盾而文字版还没改正时，文字版旁边也要显示，否则读者会照抄错文。
 * 答案框和解析框都满足时只放一次，优先放解析框。
 * @param {{ hasNotes: boolean, level?: string, hasAnswer: boolean, hasExplanation: boolean, hasImages: boolean,
 *           answerOpen: boolean, expOpen: boolean, answerView: 'text'|'orig', expView: 'text'|'orig' }} q
 * @returns {'exp'|'answer'|null}
 */
function errataPlacement(q) {
  if (!q.hasNotes) return null;
  const answerShowsImages = q.hasAnswer ? q.hasImages && q.answerView === 'orig' : q.hasImages && !q.expOpen;
  const expShowsImages = q.hasExplanation ? q.hasImages && q.expView === 'orig' : q.hasImages;
  const unsafeText = (hasText, view) => UNSAFE.has(q.level) && hasText && (!q.hasImages || view !== 'orig');
  if (q.expOpen && (expShowsImages || unsafeText(q.hasExplanation, q.expView))) return 'exp';
  if (q.answerOpen && (answerShowsImages || unsafeText(q.hasAnswer, q.answerView))) return 'answer';
  return null;
}
return { errataPlacement };
});

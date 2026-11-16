// @ts-check
/** JSON boundary for generated question data. Validation happens once, before the UI caches it. */
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} value @returns {value is string[]} */
const strings = value => Array.isArray(value) && value.every(x => typeof x === 'string');
/** @param {unknown} value @returns {value is number[]} */
const numbers = value => Array.isArray(value) && value.every(x => typeof x === 'number' && Number.isFinite(x));
/** @param {unknown} value @returns {value is string|number|null} */
const pages = value => value === null || typeof value === 'string' || typeof value === 'number';
/** @param {unknown} q @returns {q is import('./types.js').Question} */
export function isQuestion(q) {
  return object(q) && typeof q.id === 'number' && Number.isInteger(q.id) &&
    typeof q.year === 'number' && typeof q.number === 'number' && (q.score === null || typeof q.score === 'number') &&
    typeof q.source === 'string' && strings(q.categories) && strings(q.tags) && typeof q.hasFigure === 'boolean' &&
    typeof q.stem === 'string' && pages(q.pdfPage) && (q.contributor === undefined || typeof q.contributor === 'string') && typeof q.search === 'string';
}
/** @param {unknown} list @returns {list is import('./types.js').QuestionList} */
function isList(list) {
  return object(list) && typeof list.id === 'string' && typeof list.name === 'string' && numbers(list.questionIds) &&
    object(list.categoryByQuestion) && Object.values(list.categoryByQuestion).every(strings);
}
/** @param {unknown} raw @returns {import('./types.js').Library} */
export function parseLibrary(raw) {
  if (!object(raw) || typeof raw.subject !== 'string' || typeof raw.source !== 'string' || !strings(raw.topicOrder) ||
      !numbers(raw.years) || !Array.isArray(raw.questions) || !raw.questions.every(isQuestion) ||
      !Array.isArray(raw.lists) || !raw.lists.every(isList)) throw new TypeError('题库数据格式不正确');
  return { subject: raw.subject, source: raw.source, topicOrder: raw.topicOrder, years: raw.years, questions: raw.questions, lists: raw.lists };
}
/** @param {unknown} raw @returns {import('./types.js').QuestionDetail} */
export function parseQuestionDetail(raw) {
  if (!object(raw) || typeof raw.answer !== 'string' || typeof raw.explanation !== 'string' || typeof raw.notes !== 'string' ||
      !pages(raw.answerPdfPages) || (raw.errataLevel !== undefined && typeof raw.errataLevel !== 'string') || !Array.isArray(raw.originalImages)) throw new TypeError('题目解析格式不正确');
  const originalImages = raw.originalImages.map(image => {
    if (!object(image) || typeof image.src !== 'string' || typeof image.w !== 'number') throw new TypeError('题目原图格式不正确');
    return { src: image.src, w: image.w };
  });
  return { answer: raw.answer, explanation: raw.explanation, notes: raw.notes, answerPdfPages: raw.answerPdfPages, errataLevel: raw.errataLevel, originalImages };
}

// @ts-check
/* 题库（只读）：data/library.json 与按需加载的 data/questions/<id>.json。 */
import { track } from '../core/activity.js';
import { parseLibrary, parseQuestionDetail } from '../core/question.js';
/** @type {import('../core/types.js').Library | null} */
export let lib = null;
/** @type {Map<number, import('../core/types.js').Question>} */
export const byId = new Map();
/** @type {Map<number, import('../core/types.js').QuestionDetail>} */
export const details = new Map();

export async function loadLibrary() {
  const r = await fetch('data/library.json'); if (!r.ok) throw new Error(`library.json ${r.status}`);
  /** @type {unknown} */
  const raw = await r.json();
  const parsed = parseLibrary(raw);
  parsed.questions.forEach(q => byId.set(q.id, q)); lib = parsed;
  return lib;
}
/** 加载一题的答案与解析；已加载时直接返回 */
/** @param {number} id @returns {Promise<import('../core/types.js').QuestionDetail>} */
export const loadDetail = id => track(fetchDetail(id), 'question-detail');
/** @param {number} id @returns {Promise<import('../core/types.js').QuestionDetail>} */
async function fetchDetail(id) {
  const cached = details.get(id); if (cached) return cached;
  const r = await fetch(`data/questions/${id}.json`); if (!r.ok) throw new Error(`question ${id} ${r.status}`);
  /** @type {unknown} */
  const raw = await r.json();
  const d = parseQuestionDetail(raw); details.set(id, d); return d;
}

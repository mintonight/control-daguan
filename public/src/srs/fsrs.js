// @ts-check
/* FSRS 调度（ts-fsrs）：标记 → 评分。不会 = Again，不熟练 = Hard，掌握 = Good（不提供 Easy）。 */
import { reviewToday } from '../core/studyday.js';
const F = globalThis.FSRS;
export const GRADE = { unknown: F.Rating.Again, shaky: F.Rating.Hard, mastered: F.Rating.Good };

/** @type {ReturnType<typeof F.fsrs> | undefined} */
let sched;
/** @type {number | undefined} */
let schedR;
/** @param {number} retention */
const scheduler = retention => {
  if (!sched || schedR !== retention) { sched = F.fsrs(F.generatorParameters({ request_retention: retention, enable_fuzz: false, enable_short_term: false })); schedR = retention; }
  return sched;
};
/** @param {import('../core/types.js').Card} c @returns {import('ts-fsrs').Card} */
const toCard = c => ({ ...c, learning_steps: c.learning_steps ?? 0, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });
/** @param {import('ts-fsrs').Card} c @returns {import('../core/types.js').Card} */
const fromCard = c => ({ ...c, due: c.due.toISOString(), last_review: c.last_review ? new Date(c.last_review).toISOString() : undefined });
/** 同一学习日重新评分是修正：先用现有日志回退本次评分，再重新计算。短期学习步骤始终关闭。 */
/** @param {import('../core/types.js').SrsEntry | undefined} entry @param {Date} now */
const cardOf = (entry, now) => {
  if (!entry) return F.createEmptyCard(now);
  const c = toCard(entry.card), log = reviewToday(entry, now);
  if (!log) return c;
  return { ...c, due: new Date(log.due || now), last_review: log.state === 0 ? undefined : new Date(log.due || now),
    stability: log.stability ?? 0, difficulty: log.difficulty ?? 0, scheduled_days: log.scheduled_days ?? 0,
    state: log.state === 0 ? F.State.New : F.State.Review, reps: Math.max(0, c.reps - 1), learning_steps: 0,
    lapses: Math.max(0, c.lapses - (log.state === 2 && log.rating === 1 ? 1 : 0)) };
};

/** 每种标记对应的下次到期时间 */
/** @param {import('../core/types.js').SrsEntry | undefined} entry @param {number} retention @param {Date} [now] */
export function preview(entry, retention, now = new Date()) {
  const r = scheduler(retention).repeat(cardOf(entry, now), now);
  return { unknown: r[GRADE.unknown].card.due, shaky: r[GRADE.shaky].card.due, mastered: r[GRADE.mastered].card.due };
}
/** 按标记复习一次，返回新的 { card, logs } */
/** @param {import('../core/types.js').SrsEntry | undefined} entry @param {number} id
 * @param {import('../core/types.js').MarkState} mark @param {number} retention @param {Date} [now]
 * @returns {import('../core/types.js').SrsEntry} */
export function review(entry, id, mark, retention, now = new Date()) {
  const r = scheduler(retention).next(cardOf(entry, now), now, GRADE[mark]);
  const previous = reviewToday(entry, now);
  const log = { id: previous?.id || `${id}-${now.getTime()}`, rating: r.log.rating, mark, state: r.log.state, due: new Date(r.log.due).toISOString(), stability: r.log.stability,
    difficulty: r.log.difficulty, scheduled_days: r.log.scheduled_days, review: now.toISOString() };
  return { card: fromCard(r.card), logs: previous ? [...(entry?.logs || []).slice(0, -1), log] : [...(entry?.logs || []), log] };
}

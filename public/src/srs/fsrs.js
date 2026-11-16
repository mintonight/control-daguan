/* FSRS 调度（ts-fsrs）：标记 → 评分。不会 = Again，不熟练 = Hard，掌握 = Good（不提供 Easy）。 */
const F = globalThis.FSRS;
export const GRADE = { unknown: F.Rating.Again, shaky: F.Rating.Hard, mastered: F.Rating.Good };

let sched, schedR;
const scheduler = retention => {
  if (schedR !== retention) { sched = F.fsrs(F.generatorParameters({ request_retention: retention, enable_fuzz: false, enable_short_term: false })); schedR = retention; }
  return sched;
};
const toCard = c => ({ ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });
const fromCard = c => ({ ...c, due: c.due.toISOString(), last_review: c.last_review ? new Date(c.last_review).toISOString() : undefined });
const cardOf = entry => entry ? toCard(entry.card) : F.createEmptyCard(new Date());

/** 每种标记对应的下次到期时间 */
export function preview(entry, retention, now = new Date()) {
  const r = scheduler(retention).repeat(cardOf(entry), now), o = {};
  for (const [k, g] of Object.entries(GRADE)) o[k] = r[g].card.due;
  return o;
}
/** 按标记复习一次，返回新的 { card, logs } */
export function review(entry, id, mark, retention, now = new Date()) {
  const r = scheduler(retention).next(cardOf(entry), now, GRADE[mark]);
  const log = { id: `${id}-${now.getTime()}`, rating: r.log.rating, mark, state: r.log.state, due: new Date(r.log.due).toISOString(), stability: r.log.stability,
    difficulty: r.log.difficulty, scheduled_days: r.log.scheduled_days, review: now.toISOString() };
  return { card: fromCard(r.card), logs: [...(entry?.logs || []), log] };
}

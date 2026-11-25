// @ts-check
/* 控制大观 · 学习日（纯函数，无 DOM）：凌晨 DAY_CUT_H 点前仍算前一天，按本地墙上时间计算（夏令时切换日同样成立）。 */
const DAY_CUT_H = 2;
const DAY_MS = 864e5;
/** 时刻 d 所属学习日的本地 0 点 */
/** @param {Date|string|number} d */
function dayStart(d) {
  const x = new Date(+new Date(d));
  if (x.getHours() < DAY_CUT_H) x.setDate(x.getDate() - 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** now 所属学习日的最后一毫秒（次日 DAY_CUT_H 点前 1 ms） */
/** @param {Date|string|number} now */
function endOfStudyDay(now) {
  const d = dayStart(now); d.setDate(d.getDate() + 1); d.setHours(DAY_CUT_H, 0, 0, 0);
  return new Date(d.getTime() - 1);
}
/** d 比 now 晚几个学习日（同一天为 0，已过去为负） */
/** @param {Date|string|number} d @param {Date|string|number} now */
const dayDiff = (d, now) => Math.round((dayStart(d).getTime() - dayStart(now).getTime()) / DAY_MS);
/** 今天的最近一条评分；只接受应用可用于还原评分前状态的完整日志。 */
/** @param {import('./types.js').SrsEntry | undefined} entry @param {Date|string|number} now */
function reviewToday(entry, now) {
  const log = entry?.logs?.at(-1);
  return log && dayDiff(log.review, now) === 0 && log.review === entry?.card.last_review &&
    Number.isFinite(Date.parse(log.due || '')) && (log.state === 0 || log.state === 2) &&
    typeof log.stability === 'number' && typeof log.difficulty === 'number' &&
    typeof log.scheduled_days === 'number' ? log : undefined;
}
/** 今天的复测集合：未评分到期题 + 今天已评分的原到期题。由已有日志还原，无额外持久状态。 */
/** @param {Record<string, import('./types.js').SrsEntry>} srs
 * @param {Date|string|number} now @param {(id:number)=>boolean} [has] */
function dueIds(srs, now, has = () => true) {
  const lim = endOfStudyDay(now).getTime();
  return Object.entries(srs).map(([k, v]) => {
    const log = reviewToday(v, now);
    // ts-fsrs 的非新卡日志 due 是评分前 last_review；加上原 scheduled_days 即原到期时间。
    const before = log && log.state !== 0 ? Date.parse(log.due || '') + (log.scheduled_days || 0) * DAY_MS : Infinity;
    return { id: +k, due: Math.min(Date.parse(v.card.due), before) };
  }).filter(v => has(v.id) && v.due <= lim)
    .sort((a, b) => a.due - b.due || a.id - b.id).map(v => v.id);
}

export { DAY_CUT_H, DAY_MS, dayStart, endOfStudyDay, dayDiff, dueIds, reviewToday };

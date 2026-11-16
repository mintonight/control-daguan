/* 控制大观 · 学习日（纯函数，无 DOM）：凌晨 DAY_CUT_H 点前仍算前一天，按本地墙上时间计算（夏令时切换日同样成立）。 */
const DAY_CUT_H = 2;
const DAY_MS = 864e5;
/** 时刻 d 所属学习日的本地 0 点 */
function dayStart(d) {
  const x = new Date(+new Date(d));
  if (x.getHours() < DAY_CUT_H) x.setDate(x.getDate() - 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** now 所属学习日的最后一毫秒（次日 DAY_CUT_H 点前 1 ms） */
function endOfStudyDay(now) {
  const d = dayStart(now); d.setDate(d.getDate() + 1); d.setHours(DAY_CUT_H, 0, 0, 0);
  return new Date(d - 1);
}
/** d 比 now 晚几个学习日（同一天为 0，已过去为负） */
const dayDiff = (d, now) => Math.round((dayStart(d) - dayStart(now)) / DAY_MS);
/** 到 now 所在学习日结束前到期的题号，按到期时间、题号排序；has(id) 过滤掉题库里已没有的题 */
function dueIds(srs, now, has = () => true) {
  const lim = endOfStudyDay(now).getTime();
  return Object.entries(srs).filter(([k, v]) => has(+k) && Date.parse(v.card.due) <= lim)
    .sort((a, b) => Date.parse(a[1].card.due) - Date.parse(b[1].card.due) || a[0] - b[0]).map(([k]) => +k);
}

export { DAY_CUT_H, DAY_MS, dayStart, endOfStudyDay, dayDiff, dueIds };

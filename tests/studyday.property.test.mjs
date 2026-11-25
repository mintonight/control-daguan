// 学习日（凌晨 2 点分界）的性质测试：随机时刻 × 多个时区，重点覆盖夏令时切换前后。
// 时区通过 process.env.TZ 切换（Node 会立即生效）；用 Intl 独立计算本地墙上时间作为对照。
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { DAY_CUT_H, dayStart, endOfStudyDay, dayDiff, dueIds, pendingDueIds } from '../public/src/core/studyday.js';
const RUNS = { numRuns: +(process.env.FC_RUNS || 300), ...(process.env.FC_SEED ? { seed: +process.env.FC_SEED } : {}) };
const ZONES = ['UTC', 'Asia/Singapore', 'Asia/Shanghai', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Berlin',
  'Australia/Sydney', 'Australia/Lord_Howe', 'America/Santiago', 'America/St_Johns', 'Pacific/Chatham', 'Asia/Kathmandu', 'America/Havana'];
const FROM = Date.UTC(2024, 0, 1), TO = Date.UTC(2028, 0, 1), H = 36e5;

const fmt = new Map();
const wall = (ms, tz) => {
  if (!fmt.has(tz)) fmt.set(tz, new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
  const p = Object.fromEntries(fmt.get(tz).formatToParts(ms).map(x => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
};
// 对照：本地墙上时间早于 DAY_CUT_H 点就算前一个日历日
const studyDate = (ms, tz) => {
  const w = wall(ms, tz), back = w.h < DAY_CUT_H ? 1 : 0;
  const u = new Date(Date.UTC(w.y, w.mo - 1, w.d - back));
  return `${u.getUTCFullYear()}-${u.getUTCMonth() + 1}-${u.getUTCDate()}`;
};
const dateOf = (ms, tz) => { const w = wall(ms, tz); return `${w.y}-${w.mo}-${w.d}`; };
// 每个时区在测试区间内的 UTC 偏移变化时刻（逐小时扫描后二分到分钟）
const offset = (ms, tz) => { const w = wall(ms, tz); return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - Math.floor(ms / 6e4) * 6e4; };
const transitions = Object.fromEntries(ZONES.map(tz => {
  const out = [];
  for (let t = FROM; t < TO; t += H) {
    if (offset(t, tz) === offset(t + H, tz)) continue;
    let lo = t, hi = t + H; while (hi - lo > 6e4) { const mid = lo + Math.floor((hi - lo) / 2 / 6e4) * 6e4; offset(mid, tz) === offset(lo, tz) ? lo = mid : hi = mid; }
    out.push(hi);
  }
  return [tz, out];
}));
const instant = tz => fc.oneof(
  fc.integer({ min: FROM, max: TO }),
  transitions[tz].length ? fc.tuple(fc.constantFrom(...transitions[tz]), fc.integer({ min: -4 * H, max: 4 * H })).map(([t, d]) => t + d) : fc.integer({ min: FROM, max: TO }),
);
const inZone = (tz, fn) => { const prev = process.env.TZ; process.env.TZ = tz; try { return fn(); } finally { process.env.TZ = prev; } };

test('测试区间内确实含有夏令时切换（否则下面的用例没有意义）', () => {
  for (const tz of ['America/Los_Angeles', 'Europe/Berlin', 'Australia/Sydney', 'America/Santiago', 'Australia/Lord_Howe']) assert.ok(transitions[tz].length >= 6, tz);
});

for (const tz of ZONES) {
  test(`[${tz}] 学习日 = 本地墙上时间早于 ${DAY_CUT_H} 点算前一天`, () => inZone(tz, () => fc.assert(fc.property(instant(tz), ms => {
    assert.equal(dateOf(+dayStart(ms), tz), studyDate(ms, tz), new Date(ms).toISOString());
  }), RUNS)));

  test(`[${tz}] 本地 01:59 仍是前一天、02:00 起是当天`, () => inZone(tz, () => fc.assert(fc.property(instant(tz), ms => {
    const { y, mo, d } = wall(ms, tz);
    // 找出当天本地墙上时间恰为 h:mi 的时刻（不存在则跳过，存在两次则都检查）
    const at = (h, mi) => [-14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
      .flatMap(off => [0, 15, 30, 45].map(q => Date.UTC(y, mo - 1, d, h, mi) - (off * 60 + Math.sign(off || 1) * q) * 6e4))
      .filter((t, i, all) => all.indexOf(t) === i && (w => w.y === y && w.mo === mo && w.d === d && w.h === h && w.mi === mi)(wall(t, tz)));
    const prev = (() => { const u = new Date(Date.UTC(y, mo - 1, d - 1)); return `${u.getUTCFullYear()}-${u.getUTCMonth() + 1}-${u.getUTCDate()}`; })();
    for (const t of at(1, 59)) assert.equal(dateOf(+dayStart(t), tz), prev, `01:59 ${new Date(t).toISOString()}`);
    for (const t of at(2, 0)) assert.equal(dateOf(+dayStart(t), tz), `${y}-${mo}-${d}`, `02:00 ${new Date(t).toISOString()}`);
  }), RUNS)));

  test(`[${tz}] 学习日的最后一毫秒：仍是同一学习日，再过 1 ms 就是下一学习日`, () => inZone(tz, () => fc.assert(fc.property(instant(tz), ms => {
    const end = +endOfStudyDay(ms);
    assert.ok(end >= ms, '结束时刻不早于 now');
    assert.equal(dayDiff(end, ms), 0);
    assert.equal(dayDiff(end + 1, ms), 1);
    assert.ok(wall(end, tz).h < DAY_CUT_H && wall(end + 1, tz).h >= DAY_CUT_H, `分界在本地 ${DAY_CUT_H} 点：${new Date(end + 1).toISOString()}`);
  }), RUNS)));

  test(`[${tz}] dayDiff 随时间单调、dueIds 随时间只增不减`, () => inZone(tz, () => fc.assert(fc.property(
    instant(tz), fc.integer({ min: 0, max: 72 * H }), fc.array(fc.integer({ min: -96 * H, max: 96 * H }), { maxLength: 6 }), (now, dt, offs) => {
      const later = now + dt;
      for (const o of offs) assert.ok(dayDiff(now + o, later) <= dayDiff(now + o, now), 'dayDiff 随 now 推后不增大');
      const srs = Object.fromEntries(offs.map((o, i) => [String(i + 1), { card: { due: new Date(now + o).toISOString() } }]));
      const a = dueIds(srs, now), b = dueIds(srs, later);
      const pending = pendingDueIds(srs, now);
      for (const id of a) assert.ok(b.includes(id), `题 ${id} 到期后不应消失`);
      assert.deepEqual(a, [...a].sort((x, y) => Date.parse(srs[x].card.due) - Date.parse(srs[y].card.due) || x - y));
      assert.deepEqual(pending, a, '无当日评分日志时待复习应与当天集合相同');
    }), RUNS)));
}

test('[America/Los_Angeles] 夏令时结束当夜：第二次出现的 01:30（PST）仍算前一天', () => inZone('America/Los_Angeles', () => {
  const pst0130 = Date.parse('2026-11-01T09:30:00Z'), pdt0130 = Date.parse('2026-11-01T08:30:00Z'), pst0200 = Date.parse('2026-11-01T10:00:00Z');
  assert.equal(dateOf(+dayStart(pdt0130), 'America/Los_Angeles'), '2026-10-31');
  assert.equal(dateOf(+dayStart(pst0130), 'America/Los_Angeles'), '2026-10-31');
  assert.equal(dateOf(+dayStart(pst0200), 'America/Los_Angeles'), '2026-11-1');
}));

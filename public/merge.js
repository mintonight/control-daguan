/* 控制大观 · 学习记录合并（纯函数，无 DOM）。Gist 同步、导入、localStorage 迁移共用 mergeRecords。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CDGMerge = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
const NOTE_MAX = 50000;
const SYNC_KEYS = ['favorites', 'marks', 'srs', 'history', 'updated', 'retention', 'retentionAt', 'notes'];
const syncPart = r => Object.fromEntries(SYNC_KEYS.map(k => [k, r[k]]));
const sortObj = v => Array.isArray(v) ? v.map(sortObj) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortObj(v[k])])) : v;
const canon = v => JSON.stringify(sortObj(v));

/** notes: { [题号]: { text, at } }；text 为空表示已删除（保留时间戳，让删除也能同步） */
function normalizeNotes(n) {
  const out = {};
  if (!n || typeof n !== 'object') return out;
  for (const [k, v] of Object.entries(n)) {
    if (!/^\d+$/.test(k) || !v || typeof v.text !== 'string') continue;
    const at = +v.at; if (!(at > 0)) continue;
    out[k] = { text: v.text.slice(0, NOTE_MAX), at };
  }
  return out;
}
// 两者都存在且不同时，取规范化 JSON 较大的一个：与参数顺序无关
const pick = (x, y) => x == null ? y : y == null ? x : canon(y) > canon(x) ? y : x;
const newer = (x, y, t) => x == null ? y : y == null ? x : t(y) > t(x) ? y : t(x) > t(y) ? x : pick(x, y);
const noteAt = n => n.at;
const reviewAt = c => Date.parse(c.last_review || '') || 0;
const markAt = m => +m.at || 0;

function mergeNotes(a, b) {
  a = normalizeNotes(a); b = normalizeNotes(b);
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    out[k] = x && y && x.at === y.at ? (y.text > x.text ? y : x) : newer(x, y, noteAt);
  }
  return out;
}
function unionLogs(...lists) {
  const m = new Map(); lists.flat().forEach(l => { if (l && l.id) m.set(l.id, pick(m.get(l.id), l)); });
  return [...m.values()].sort((x, y) => Date.parse(x.review) - Date.parse(y.review) || (x.id < y.id ? -1 : 1));
}
function unionHistory(a, b) {
  const key = h => `${h.id}:${h.at}:${h.state}`, m = new Map();
  [...(a || []), ...(b || [])].forEach(h => { if (h && !m.has(key(h))) m.set(key(h), h); });
  return [...m.values()].sort((x, y) => x.at - y.at || String(x.id).localeCompare(String(y.id)) || String(x.state).localeCompare(String(y.state)));
}
// 每题的「最后更新时间」：updated[id]；旧数据没有时用标记时间/最近复习时间推算
const ts = (r, id) => Math.max(+(r.updated?.[id]) || 0, +(r.marks?.[id]?.at) || 0, Date.parse(r.srs?.[id]?.card?.last_review || '') || 0);
function questionIds(...recs) {
  const ids = new Set();
  for (const r of recs) {
    Object.keys(r.updated || {}).forEach(k => ids.add(String(k))); Object.keys(r.marks || {}).forEach(k => ids.add(String(k)));
    Object.keys(r.srs || {}).forEach(k => ids.add(String(k))); (r.favorites || []).forEach(k => ids.add(String(k)));
  }
  return [...ids].sort();
}

/**
 * 合并两份学习记录，返回新对象（只含 SYNC_KEYS），不修改入参。
 * policy 'sync'（Gist 同步 / 迁移）：逐题取最后更新的一方（收藏、标记、FSRS 卡片整体），较新的删除/重置同样生效。
 * policy 'import'（导入文件 / 记录码）：只增不删，导入文件没有删除记录——收藏取并集，标记取较新的 at，卡片取较新的 last_review。
 * 两种策略共用：复习日志按 id 取并集；笔记逐题按 at 取较新（删除同样按时间生效）；记录历史取并集；
 * 同一时刻的冲突按内容决出，与参数顺序无关。记忆率按 retentionAt 取较新；时间相同保留 a（本机）的设置。
 */
function mergeRecords(a, b, policy = 'sync') {
  a = a || {}; b = b || {};
  const out = { favorites: [], marks: {}, srs: {}, updated: {} };
  const fav = (r, id) => (r.favorites || []).map(String).includes(id);
  for (const id of questionIds(a, b)) {
    const ta = ts(a, id), tb = ts(b, id), ma = a.marks?.[id], mb = b.marks?.[id], ca = a.srs?.[id]?.card, cb = b.srs?.[id]?.card;
    let f, m, c;
    if (policy === 'sync' && ta !== tb) {
      const w = tb > ta ? b : a;
      f = fav(w, id); m = w.marks?.[id]; c = w.srs?.[id]?.card;
    } else if (policy === 'sync') {
      f = fav(a, id) || fav(b, id); m = pick(ma, mb); c = pick(ca, cb);
    } else {
      f = fav(a, id) || fav(b, id); m = newer(ma, mb, markAt); c = newer(ca, cb, reviewAt);
    }
    if (f) out.favorites.push(Number(id));
    if (m) out.marks[id] = m;
    if (c) out.srs[id] = { card: c, logs: unionLogs(a.srs?.[id]?.logs || [], b.srs?.[id]?.logs || []) };
    const t = Math.max(ta, tb); if (t) out.updated[id] = t;
  }
  out.notes = mergeNotes(a.notes, b.notes);
  out.history = unionHistory(a.history, b.history);
  const ra = +a.retentionAt || 0, rb = +b.retentionAt || 0;
  out.retention = rb > ra ? b.retention : (a.retention ?? b.retention); out.retentionAt = Math.max(ra, rb);
  return out;
}

return { mergeRecords, mergeNotes, normalizeNotes, unionLogs, syncPart, canon, SYNC_KEYS, NOTE_MAX };
});

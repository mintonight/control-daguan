/* 学习记录：唯一的可写状态。界面只通过这里的函数读写记录；保存、跨标签页通知、云同步排队都在这里完成。 */
import { kv } from './kv.js';
import { byId } from './library.js';
import { normRec, normSrs, MARK_STATES } from '../core/record.js';
import { mergeRecords, canon, syncPart, normalizeNotes, NOTE_MAX } from '../core/merge.js';
import { endOfStudyDay, dueIds } from '../core/studyday.js';
import * as fsrs from '../srs/fsrs.js';
import * as prefs from '../core/preferences.js';
import { GistSync } from '../sync/gist.js';

// 持久化格式（不要改名）：IndexedDB kv['rec']；IndexedDB 不可用时退回 localStorage[LEGACY_KEY]；笔记草稿备份 localStorage[DRAFT_KEY + 题号]
const LEGACY_KEY = 'control-daguan:v1';
const DRAFT_KEY = 'control-daguan:note-draft:';
const CHANNEL = 'control-daguan';

/** 当前学习记录（只读视图；修改一律通过下面的 setter） */
export let rec = normRec({});
export let migrated = false;
let useLS = false, gist = null;
const hooks = { changed: () => {}, saveFailed: () => {}, syncStatus: () => {} };
/** 界面注册回调：记录被其他标签页或云同步改动（changed）、保存失败（saveFailed）、同步状态变化（syncStatus） */
export const setHooks = h => Object.assign(hooks, h);

const bc = 'BroadcastChannel' in globalThis ? new BroadcastChannel(CHANNEL) : null;
if (bc) bc.onmessage = async () => { rec = await loadRec(); hooks.changed(); };

export async function persist() {
  if (useLS) { localStorage.setItem(LEGACY_KEY, JSON.stringify(rec)); return; }
  await kv.set('rec', rec);
}
/** 保存到本地；sync=true 时通知其他标签页并排队云同步 */
export const save = (sync = true) => persist().then(() => { if (sync) { bc?.postMessage('rec'); gist?.schedule(); } }).catch(() => hooks.saveFailed());
const touch = id => { rec.updated[id] = Date.now(); };

export async function loadRec() {
  let stored = null, legacy = null;
  try { const s = localStorage.getItem(LEGACY_KEY); if (s) legacy = normRec(JSON.parse(s)); } catch {}
  try { stored = await kv.get('rec'); } catch { useLS = true; return legacy || normRec({}); }
  if (!legacy) return normRec(stored || {});
  // 迁移：localStorage 里的旧记录并入 IndexedDB（逐题取较新的一方），写入并读回确认后再删除旧键
  const merged = stored ? normRec({ ...normRec(stored), ...mergeRecords(normRec(stored), legacy) }) : legacy;
  await kv.set('rec', merged);
  const back = await kv.get('rec');
  if (back && canon(syncPart(back)) === canon(syncPart(merged))) { localStorage.removeItem(LEGACY_KEY); migrated = true; }
  return merged;
}
export async function init() { rec = await loadRec(); }

// ---------- 读 ----------
export const isFavorite = id => rec.favorites.includes(id);
export const markOf = id => rec.marks[id]?.state;
export const hasNote = id => !!rec.notes[id]?.text?.trim();
export const noteOf = id => rec.notes[id];
export const previewMarks = id => fsrs.preview(rec.srs[id], rec.retention);
export const dueToday = () => dueIds(rec.srs, new Date(), id => byId.has(id));
export const isDueAfterToday = id => Date.parse(rec.srs[id].card.due) > endOfStudyDay(new Date()).getTime();

// ---------- 写 ----------
/** 切换收藏，返回切换前是否已收藏 */
export function toggleFavorite(id) {
  const i = rec.favorites.indexOf(id);
  i >= 0 ? rec.favorites.splice(i, 1) : rec.favorites.push(id);
  touch(id); save(); return i >= 0;
}
export function setMark(id, state) {
  if (state) { rec.marks[id] = { state, at: Date.now() }; rec.srs[id] = fsrs.review(rec.srs[id], id, state, rec.retention); } else delete rec.marks[id];
  touch(id);
  rec.history.push({ id, state: state || null, at: Date.now() }); save();
}
export function resetSrs() { Object.keys(rec.srs).forEach(touch); rec.srs = {}; save(); }
/** 拖动滑块时只改内存（实时显示）；松手时 commitRetention 记下时间并保存 */
export const previewRetention = v => { rec.retention = Math.round(v * 100) / 100; };
export const commitRetention = () => { rec.retentionAt = Date.now(); save(); };
// 界面偏好：每个字段一个带类型的 setter，非法值直接拒绝（不会写进记录）
/** @param {import('../core/record.js').ViewMode} mode */
export function setMode(mode) { prefs.setMode(rec, mode); save(); }
/** @param {import('../core/record.js').FontScale} scale */
export function setFontScale(scale) { prefs.setFontScale(rec, scale); save(); }
/** @param {boolean} collapsed */
export function setCollapsed(collapsed) { prefs.setCollapsed(rec, collapsed); save(); }
/** 最近展开的设置分组：只存本机，不触发同步
 * @param {import('../core/record.js').SettingSection} sec */
export function setSettingsSection(sec) { prefs.setSettingsSection(rec, sec); save(false); }
export function setOpen(path, open) { rec.open[path] = open; save(); }
/** 写入一题笔记（空串 = 删除）；保存成功后删除该题的草稿备份 */
export function saveNote(id, text) {
  // 本机编辑总是晚于它所基于的版本（防止设备间时钟偏差让刚写的内容被同步覆盖）
  const at = Math.max(Date.now(), (rec.notes[id]?.at || 0) + 1);
  rec.notes[id] = { text: text.trim() ? text : '', at };
  save().then(() => { if (rec.notes[id]?.at === at) dropDraft(id); });
}
// 草稿同步备份到 localStorage：关页/崩溃时 IndexedDB 异步写入可能来不及完成，下次打开时恢复
export const backupDraft = (id, text) => { try { localStorage.setItem(DRAFT_KEY + id, JSON.stringify({ text, at: Math.max(Date.now(), (rec.notes[id]?.at || 0) + 1) })); } catch {} };
const dropDraft = id => { try { localStorage.removeItem(DRAFT_KEY + id); } catch {} };
/** 把比已存笔记新的草稿备份写回记录，返回恢复的题数 */
export function restoreDrafts() {
  let n = 0;
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(DRAFT_KEY)) continue;
    const id = k.slice(DRAFT_KEY.length);
    try {
      const d = JSON.parse(localStorage.getItem(k)), cur = rec.notes[id];
      if (byId.has(+id) && typeof d?.text === 'string' && d.at > (cur?.at || 0) && d.text !== (cur?.text || '')) { rec.notes[id] = { text: d.text.trim() ? d.text.slice(0, NOTE_MAX) : '', at: d.at }; n++; }
    } catch {}
    localStorage.removeItem(k);
  }
  if (n) save();
  return n;
}

// ---------- 导入导出 ----------
export const exportData = () => ({ app: 'control-daguan', version: 2, exportedAt: new Date().toISOString(), favorites: rec.favorites, marks: rec.marks, history: rec.history, srs: rec.srs, retention: rec.retention, notes: rec.notes });
// 记录码里每题只保留最近 20 条复习日志、最近 200 条历史，控制长度
const CODE_LOGS = 20, CODE_HISTORY = 200;
export const codeData = () => ({ app: 'control-daguan', version: 2, favorites: rec.favorites, marks: rec.marks, history: rec.history.slice(-CODE_HISTORY),
  srs: Object.fromEntries(Object.entries(rec.srs).map(([k, v]) => [k, { card: v.card, logs: v.logs.slice(-CODE_LOGS) }])), retention: rec.retention, notes: rec.notes });
/** 导入导出文件或记录码（v1/v2）；只增不删，未知题号忽略。格式不对时抛出带说明的 Error */
export function importRecords(d) {
  if (!d || d.app !== 'control-daguan' || !Array.isArray(d.favorites) || typeof d.marks !== 'object') throw new Error('不是有效的控制大观记录文件，请重新导出 JSON。');
  const known = id => byId.has(Number(id));
  const onlyKnown = o => Object.fromEntries(Object.entries(o).filter(([k]) => known(k)));
  const incoming = {
    favorites: d.favorites.map(Number).filter(known),
    marks: Object.fromEntries(Object.entries(d.marks || {}).filter(([k, v]) => known(k) && v && MARK_STATES.includes(v.state))),
    srs: onlyKnown(normSrs(d.srs)), notes: onlyKnown(normalizeNotes(d.notes)),
    history: Array.isArray(d.history) ? d.history.filter(h => h && known(h.id)) : [],
  };
  const snap = id => canon([rec.favorites.includes(+id), rec.marks[id] || null, rec.srs[id] || null]);
  const before = new Map([...byId.keys()].map(id => [id, snap(id)]));
  rec = normRec({ ...rec, ...mergeRecords(rec, incoming, 'import') });
  // 导入的改动算作本机此刻的编辑，下次同步时覆盖云端较旧的状态
  for (const id of byId.keys()) if (snap(id) !== before.get(id)) touch(id);
  save();
}

// ---------- 云同步 ----------
export async function initSync() {
  gist = new GistSync({
    kv, getLocal: () => rec, isOnline: () => navigator.onLine !== false, onStatus: (...a) => hooks.syncStatus(...a),
    applyMerged: async m => { rec = normRec({ ...rec, ...m }); await save(false); bc?.postMessage('rec'); hooks.changed(); },
  });
  try { await gist.init(); } catch { return; }
  if (gist.connected) gist.sync().catch(() => {});
  addEventListener('online', () => { if (gist.connected) gist.sync().catch(() => {}); });
  addEventListener('offline', () => { if (gist.connected) gist.saveCfg({ lastError: '当前离线，联网后自动同步。', errorKind: 'offline' }); });
}
export const connectSync = token => gist.connect(token);
export const syncNow = () => gist.sync();
export const disconnectSync = () => gist.disconnect();

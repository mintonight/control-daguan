// @ts-check
/* 学习记录的规范化（纯函数）：IndexedDB / localStorage / 导入文件读出的任何形状都先过这里。 */
import { normalizeNotes } from './merge.js';

/** @typedef {import('./types.js').MarkState} MarkState */
/** @typedef {import('./types.js').FontScale} FontScale */
/** @typedef {import('./types.js').SettingSection} SettingSection */
/** @typedef {import('./types.js').Rec} Rec */
/** @typedef {import('./types.js').ViewMode} ViewMode */
/** @typedef {import('./types.js').SrsEntry} SrsEntry */

/** @type {MarkState[]} */
export const MARK_STATES = ['shaky', 'unknown', 'mastered'];
/** @type {FontScale[]} */
export const FONT_SCALES = [85, 100, 115, 130];
// 设置面板折叠分组；最近展开的一组记在本机偏好（不导出、不同步）
/** @type {SettingSection[]} */
export const SETTING_SECTIONS = ['read', 'review', 'records', 'sync', 'offline', 'about'];
const RETENTION_MIN = 0.8, RETENTION_MAX = 0.95, RETENTION_DEFAULT = 0.9;

/** 补齐旧记录的缺省字段；外部 JSON 的完整验证仍由导入和同步边界负责
 * @param {Partial<Rec>} r
 * @returns {Rec} */
export function normRec(r) {
  const ret = Number(r.retention);
  return { favorites: Array.isArray(r.favorites) ? r.favorites.map(Number) : [], marks: r.marks && typeof r.marks === 'object' ? r.marks : {},
    srs: normSrs(r.srs), retention: ret >= RETENTION_MIN && ret <= RETENTION_MAX ? Math.round(ret * 100) / 100 : RETENTION_DEFAULT, retentionAt: Number(r.retentionAt) || 0,
    updated: r.updated && typeof r.updated === 'object' ? r.updated : {},
    history: Array.isArray(r.history) ? r.history : [], mode: r.mode === 'multiple' ? 'multiple' : 'single',
    fontScale: r.fontScale !== undefined && FONT_SCALES.includes(r.fontScale) ? r.fontScale : 100, collapsed: !!r.collapsed, setSec: r.setSec !== undefined && SETTING_SECTIONS.includes(r.setSec) ? r.setSec : 'read', open: r.open && typeof r.open === 'object' ? r.open : {},
    notes: normalizeNotes(r.notes) };
}
// srs: { [题号]: { card: FSRS 卡片（日期存 ISO 字符串）, logs: [复习日志] } }
/** @param {Record<string, SrsEntry> | null | undefined} s
 * @returns {Record<string, SrsEntry>} */
export function normSrs(s) {
  /** @type {Record<string, SrsEntry>} */
  const out = {};
  if (!s || typeof s !== 'object') return out;
  for (const [k, v] of Object.entries(s)) {
    if (!v || typeof v !== 'object' || !v.card || isNaN(Date.parse(v.card.due))) continue;
    out[k] = { card: v.card, logs: Array.isArray(v.logs) ? v.logs.filter(l => l && l.id && l.review) : [] };
  }
  return out;
}

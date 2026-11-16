// @ts-check
/** Typed preference updates. Persistence and sync notifications stay in store/records.js. */
import { FONT_SCALES, SETTING_SECTIONS } from './record.js';
/** @param {boolean} ok @param {string} field @param {unknown} value */
const check = (ok, field, value) => { if (!ok) throw new TypeError(`${field} 不合法：${JSON.stringify(value)}`); };
/** @param {import('./types.js').Rec} rec @param {import('./types.js').ViewMode} mode */
export function setMode(rec, mode) { check(mode === 'single' || mode === 'multiple', 'mode', mode); rec.mode = mode; }
/** @param {import('./types.js').Rec} rec @param {import('./types.js').FontScale} scale */
export function setFontScale(rec, scale) { check(FONT_SCALES.includes(scale), 'fontScale', scale); rec.fontScale = scale; }
/** @param {import('./types.js').Rec} rec @param {boolean} collapsed */
export function setCollapsed(rec, collapsed) { check(typeof collapsed === 'boolean', 'collapsed', collapsed); rec.collapsed = collapsed; }
/** @param {import('./types.js').Rec} rec @param {import('./types.js').SettingSection} section */
export function setSettingsSection(rec, section) { check(SETTING_SECTIONS.includes(section), 'setSec', section); rec.setSec = section; }

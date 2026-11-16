/* 界面通用小工具 */
export const $ = (s, r = document) => r.querySelector(s);
export { escapeHTML as esc } from './html.js';
import { debounce } from '../core/timers.js';
export const isMobile = () => matchMedia('(max-width:900px)').matches;
const TOAST_MS = 2200;
const hideToast = debounce(() => { $('#toast').hidden = true; }, TOAST_MS, { idle: false });
export function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; hideToast(); }
export function closePops(except) { document.querySelectorAll('.popover').forEach(p => { if (p !== except && !p.contains(except)) { p.hidden = true; const b = p.previousElementSibling; if (b?.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false'); } }); }

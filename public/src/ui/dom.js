/* 界面通用小工具 */
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const isMobile = () => matchMedia('(max-width:900px)').matches;
let toastT;
export function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2200); }
export function closePops(except) { document.querySelectorAll('.popover').forEach(p => { if (p !== except && !p.contains(except)) { p.hidden = true; const b = p.previousElementSibling; if (b?.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false'); } }); }

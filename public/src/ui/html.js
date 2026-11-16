/* HTML 片段的唯一入口：html`` 默认转义插值；只有 Html 对象（html`` 的结果或 trusted() 标记的已清洗输出）原样拼接。
   setHTML / insertHTML 只接受 Html，eslint 禁止在本文件之外直接写 innerHTML / insertAdjacentHTML / outerHTML。 */
export class Html {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const escapeHTML = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const part = v => v == null ? '' : v instanceof Html ? v.s : Array.isArray(v) ? v.map(part).join('') : escapeHTML(v);
/** 模板标签：插值按文本转义；数组逐项拼接；null / undefined 输出为空（布尔值照常输出 true/false，便于写 aria 属性） */
export const html = (strings, ...vals) => new Html(strings.reduce((a, s, i) => a + part(vals[i - 1]) + s));
/** 标记已由可信来源生成或清洗过的 HTML（KaTeX、DOMPurify、内置图标） */
export const trusted = s => new Html(String(s));
const need = h => { if (!(h instanceof Html)) throw new TypeError('setHTML/insertHTML 只接受 html`` 或 trusted() 的结果'); return h.s; };
export const setHTML = (el, h) => { el.innerHTML = need(h); };
export const insertHTML = (el, where, h) => { el.insertAdjacentHTML(where, need(h)); };

/* 笔记 Markdown 渲染：marked（GFM）+ KaTeX 公式 + DOMPurify 清洗。 */
import { trusted } from './html.js';
const { katex, marked, DOMPurify } = globalThis;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tex = (src, display) => {
  try { return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: false, trust: false, maxExpand: 500 }); }
  catch { return `<code>${esc(src)}</code>`; }
};
// $$…$$ 独占一行时为块级公式；行内 $…$ 与 $$…$$ 由行内扩展处理。代码块/行内代码里的 $ 不会被当成公式。
const mathBlock = {
  name: 'mathBlock', level: 'block',
  start(src) { const m = /(^|\n)[ \t]{0,3}\$\$/.exec(src); return m ? m.index + m[1].length : undefined; },
  tokenizer(src) { const m = /^[ \t]{0,3}\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src); if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() }; },
  renderer(t) { return `<div class="math-block">${tex(t.text, true)}</div>\n`; },
};
const mathInline = {
  name: 'mathInline', level: 'inline',
  start(src) { const i = src.indexOf('$'); return i < 0 ? undefined : i; },
  tokenizer(src) {
    let m = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (m) return { type: 'mathInline', raw: m[0], text: m[1].trim(), display: true };
    m = /^\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
    if (m) return { type: 'mathInline', raw: m[0], text: m[1], display: false };
  },
  renderer(t) { return tex(t.text, t.display); },
};
const md = new marked.Marked({ gfm: true, breaks: true });
md.use({ extensions: [mathBlock, mathInline], renderer: { html: t => esc(t.text) } }); // 原始 HTML 一律按文本显示
const purify = DOMPurify;
purify.addHook('afterSanitizeAttributes', n => {
  if (n.tagName === 'A' && n.getAttribute('href')) { n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener noreferrer nofollow'); }
  if (n.tagName === 'IMG') { n.setAttribute('loading', 'lazy'); n.setAttribute('referrerpolicy', 'no-referrer'); }
});
// KaTeX 把 TeX 源码放在 <annotation> 里，选中复制时 copy-tex 用它还原 $…$；只允许纯文本 annotation（不含 annotation-xml）。
purify.addHook('afterSanitizeElements', n => { if (n.nodeName === 'annotation' && n.childElementCount) n.replaceChildren(n.textContent); });
const SAFE = { USE_PROFILES: { html: true, svg: true, mathMl: true }, ADD_TAGS: ['semantics', 'annotation'], ADD_ATTR: ['target', 'encoding'], FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe'], FORBID_ATTR: ['id', 'name'] };
/** Markdown → 已清洗的 Html；空笔记返回 null */
export function renderNote(text) {
  if (!text || !text.trim()) return null;
  let html;
  try { html = md.parse(text); } catch { html = `<pre>${esc(text)}</pre>`; }
  return trusted(purify.sanitize(html, SAFE));
}

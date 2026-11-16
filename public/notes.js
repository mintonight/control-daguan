/* 控制大观 · 题目笔记：Markdown（marked，GFM）+ KaTeX 公式 + DOMPurify 清洗；笔记数据的规范化与合并见 merge.js。 */
(() => {
'use strict';
const MAX = window.CDGMerge.NOTE_MAX; // 单题笔记上限（字符）
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
const SAFE = { USE_PROFILES: { html: true, svg: true, mathMl: true }, ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe'], FORBID_ATTR: ['id', 'name'] };
/** Markdown → 已清洗的 HTML */
function render(text) {
  if (!text || !text.trim()) return '';
  let html;
  try { html = md.parse(text); } catch { html = `<pre>${esc(text)}</pre>`; }
  return purify.sanitize(html, SAFE);
}
const has = (notes, id) => !!notes?.[id]?.text?.trim();
window.CDGNotes = { render, has, MAX };
})();

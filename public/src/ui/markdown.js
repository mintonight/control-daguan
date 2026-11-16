/* 题干、答案、解析的轻量 Markdown：段落、**粗体**、$公式$、![图|宽](src)；可高亮搜索词。 */
import { esc } from './dom.js';
import { trusted } from './html.js';
const { katex } = globalThis;

function tex(src, display) {
  try { return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: false }); }
  catch { return esc(src); }
}
function inline(s, hl) {
  const out = []; let i = 0;
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|!\[([^\]]*)\]\(([^)]+)\)|\*\*(.+?)\*\*/g; let m;
  const txt = t => { let h = esc(t); if (hl) h = h.replace(new RegExp(hl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), x => `<mark>${x}</mark>`); return h; };
  while ((m = re.exec(s))) {
    out.push(txt(s.slice(i, m.index)));
    if (m[1] != null) out.push(tex(m[1], true));
    else if (m[2] != null) out.push(tex(m[2], false));
    else if (m[4] != null) { const [alt, w] = m[3].split('|'); out.push(`<span class="fig"><img src="${esc(m[4])}" alt="${esc(alt)}" ${w ? `style="width:${+w}px"` : ''} loading="lazy" data-zoom title="单击放大图片"></span>`); }
    else out.push(`<strong>${txt(m[5])}</strong>`);
    i = re.lastIndex;
  }
  out.push(txt(s.slice(i)));
  return out.join('');
}
/** 返回 Html（KaTeX 输出与转义后的文本拼成，可直接放进 html``） */
export const md = (s, hl) => trusted(s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
  const h = inline(p.replace(/\n/g, ' '), hl);
  return /^<span class="fig">[^]*<\/span>$/.test(h) ? `<div class="fig">${h.replace(/^<span class="fig">|<\/span>$/g, '')}</div>` : `<p>${h}</p>`;
}).join(''));


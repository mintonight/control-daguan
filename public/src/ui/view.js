/* 主界面：目录、题目卡片、翻页、URL 状态与卡片上的交互。读写学习记录一律通过 store/records.js。 */
import * as store from '../store/records.js';
import { lib, byId, details, loadDetail } from '../store/library.js';
import { dayStart, dayDiff as dayDiffAt, DAY_MS } from '../core/studyday.js';
import { errataPlacement } from '../core/errata.js';
import { $, esc, isMobile, toast, closePops } from './dom.js';
import { IC, MARK_IC } from './icons.js';
import { md } from './markdown.js';
import { noteHTMLFor, commitNote, clearNote, flushNotes, afterNoteSaved, onNoteInput, focusNote } from './notes-editor.js';

const MARKS = { shaky: '不熟练', unknown: '不会', mastered: '掌握' };
const dayDiff = d => dayDiffAt(d, new Date());
const ivl = d => { const n = Math.max(0, Math.round((new Date(d) - new Date()) / DAY_MS)); return n < 1 ? '今天' : n < 30 ? `${n}天` : n < 365 ? `${Math.round(n / 3) / 10}月` : `${Math.round(n / 36.5) / 10}年`; };
const fmtDue = d => { const n = dayDiff(d), dt = dayStart(d); const md = `${dt.getMonth() + 1}月${dt.getDate()}日`; return n < 0 ? `已到期 ${-n} 天（${md}）` : n === 0 ? `今日待复习（${md}）` : `下次复习：${md}（${n} 天后）`; };

const st = { tab: 'bank', listId: 'complete', node: null, qid: null, q: '', page: 0, show: {}, rv: 'due', noteMode: {} };
const DUE_NODE = '今日待复习';

// ---------- 题目集合 ----------
const curList = () => lib.lists.find(l => l.id === st.listId) || lib.lists[0];
function scopeIds() {
  const L = curList(); let ids = L.questionIds;
  if (st.tab === 'fav') ids = ids.filter(id => store.rec.favorites.includes(id));
  if (st.tab === 'retest') ids = st.rv === 'due' ? store.dueToday().filter(id => ids.includes(id)) : ids.filter(id => ['shaky', 'unknown'].includes(store.rec.marks[id]?.state));
  if (st.q) { const k = st.q.toLowerCase(); ids = ids.filter(id => (byId.get(id).search + ' ' + (L.categoryByQuestion[id] || []).join(' ') + ' ' + (store.rec.notes[id]?.text || '')).toLowerCase().includes(k)); }
  return ids;
}
function buildTree(ids) {
  // 今日待复习：不分章节，按到期时间排成一个小节
  if (st.tab === 'retest' && st.rv === 'due') return { list: ids.length ? [{ name: DUE_NODE, path: DUE_NODE, ids, list: [] }] : [] };
  const L = curList(), root = { kids: new Map(), ids: [] };
  for (const id of ids) for (const path of L.categoryByQuestion[id] || []) {
    let n = root; const parts = path.split(' / ');
    parts.forEach((p, i) => {
      if (!n.kids.has(p)) n.kids.set(p, { name: p, path: parts.slice(0, i + 1).join(' / '), kids: new Map(), ids: [] });
      n = n.kids.get(p); if (!n.ids.includes(id)) n.ids.push(id);
    });
  }
  const ord = lib.topicOrder;
  const sortKids = n => { n.list = [...n.kids.values()].sort((a, b) => {
    const ia = ord.indexOf(a.name), ib = ord.indexOf(b.name);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    if (/^\d{4}$/.test(a.name) && /^\d{4}$/.test(b.name)) return b.name - a.name;
    return 0; }); n.list.forEach(sortKids); };
  sortKids(root);
  // 重点题目按考点页点名顺序排列（与 featured 题单一致）
  const feat = lib.lists.find(l => l.id === 'featured');
  if (feat) {
    const rank = id => { const i = feat.questionIds.indexOf(id); return i < 0 ? 1e9 : i; };
    const walk = n => {
      if (n.path === '重点题目' || (n.path && n.path.startsWith('重点题目 / '))) n.ids.sort((a, b) => rank(a) - rank(b));
      (n.list || []).forEach(walk);
    };
    walk(root);
  }
  return root;
}
function flatNodes(root) { const out = []; const walk = n => n.list.forEach(k => { out.push(k); walk(k); }); walk(root); return out; }
function sectionIds(tree) {
  if (!st.node) return [];
  const n = flatNodes(tree).find(x => x.path === st.node);
  return n ? n.ids : [];
}
function topSections(tree) { return tree.list.map(n => n.path); }

// ---------- 主渲染 ----------
let tree;
function ensureSelection() {
  const ids = scopeIds(); tree = buildTree(ids);
  const all = flatNodes(tree).map(n => n.path);
  if (!st.node || !all.includes(st.node)) {
    // 优先选择包含当前题目的顶层分类
    const top = tree.list.find(n => n.ids.includes(st.qid)) || tree.list[0];
    st.node = top ? top.path : null;
  }
  const sec = sectionIds(tree);
  if (!sec.includes(st.qid)) st.qid = sec[0] ?? null;
  return sec;
}
export function render() {
  flushNotes();
  document.documentElement.style.setProperty('--fs', store.rec.fontScale / 100);
  const sec = ensureSelection();
  // tabs
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === st.tab));
  $('#app').classList.toggle('app-collapsed', store.rec.collapsed && !isMobile());
  $('#tocBtn').setAttribute('aria-expanded', isMobile() ? $('#app').classList.contains('drawer-open') : !store.rec.collapsed);
  $('#listBtn').parentElement.hidden = st.tab !== 'bank';
  $('#rvSeg').hidden = st.tab !== 'retest';
  document.querySelectorAll('#rvSeg button').forEach(b => b.classList.toggle('on', b.dataset.rv === st.rv));
  const nDue = store.dueToday().length, bd = $('#dueBadge'); bd.hidden = !nDue; bd.textContent = nDue; bd.title = `今日待复习 ${nDue} 题`;
  $('#retention').value = store.rec.retention; $('#retentionVal').textContent = store.rec.retention.toFixed(2);
  const L = curList();
  $('#listName').textContent = `${L.name} · ${L.questionIds.length} 题`;
  const node = st.node ? flatNodes(tree).find(n => n.path === st.node) : null;
  $('#sectionLabel').textContent = node ? `${st.q ? '搜索 · ' : ''}${st.tab === 'retest' ? '复测 · ' : ''}${node.name}  ${sec.length} 题` : (st.q ? `搜索「${st.q}」 0 题` : '');
  renderTree(); renderCards(sec); renderPager(sec); syncURL();
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === store.rec.mode));
  document.querySelectorAll('#fontSeg button').forEach(b => b.classList.toggle('on', +b.dataset.font === store.rec.fontScale));
  $('#accReadSum').textContent = `${store.rec.mode === 'multiple' ? '多题' : '单题'} · ${FONT_NAME[store.rec.fontScale] || '标准'}`;
  $('#accReviewSum').textContent = `记忆率 ${store.rec.retention.toFixed(2)}`;
}
const FONT_NAME = { 85: '小', 100: '标准', 115: '大', 130: '特大' };

export function renderTree() {
  const el = $('#tree');
  const markedCount = ids => ids.filter(id => store.rec.marks[id]).length;
  const nodeHTML = (n, depth) => {
    const open = store.rec.open[n.path] ?? (n.path === st.node || (st.node || '').startsWith(n.path + ' / '));
    const hasKids = n.list.length > 0;
    const cnt = st.tab === 'bank' ? `已标记 ${markedCount(n.ids)} / ${n.ids.length}` : `${n.ids.length} 题`;
    const selMark = n.path === st.node ? IC.check : '';
    const nn = n.ids.filter(id => store.hasNote(id)).length;
    const noteMark = nn ? `<span class="tn" title="${nn} 题有笔记" aria-label="${nn} 题有笔记">${IC.pen}${nn}</span>` : '';
    return `<div class="node ${depth === 0 ? 'top' : ''} ${open && hasKids ? 'open' : ''} ${n.path === st.node ? 'sel' : ''}" data-path="${esc(n.path)}">
      <button type="button" class="tw ${hasKids ? '' : 'leaf'}" aria-label="${open ? '收起' : '展开'}${esc(n.name)}" data-act="toggle">${IC.chev}</button>
      <button type="button" class="nm" data-act="select"><span class="t" title="${esc(n.name)}">${esc(n.name)}</span><span class="c">${noteMark}${selMark}${cnt}</span></button></div>
      ${hasKids && open ? `<div class="kids">${n.list.map(k => nodeHTML(k, depth + 1)).join('')}</div>` : ''}`;
  };
  el.innerHTML = tree.list.length ? tree.list.map(n => nodeHTML(n, 0)).join('') : `<div class="empty" style="padding:30px 0">${st.q ? '没有匹配的题目' : st.tab === 'fav' ? '暂无收藏题目' : st.tab === 'retest' ? (st.rv === 'due' ? '今日没有待复习的题目' : '暂无复测题目') : '暂无章节'}</div>`;
}


function errataHTML(d) {
  if (!d || !d.notes) return '';
  const lv = d.errataLevel || '';
  const title = lv === 'ok' ? '已核对' : '勘误';
  const badge = lv === 'severe' ? '严重，原答案不可照抄' : lv === 'conflict' ? '题目矛盾，原答案不可照抄' : '';
  const sev = lv === 'ok' ? 'ok' : (lv === 'severe' || lv === 'conflict') ? 'severe' : 'warn';
  return `<aside class="note errata" data-sev="${sev}"><div class="errata-hd"><span class="errata-tag">${title}</span>${badge ? `<span class="errata-badge">${badge}</span>` : ''}</div><div class="errata-bd">${md(d.notes)}</div></aside>`;
}
function errataIn(kind, sh, d, hasImgs) {
  const at = errataPlacement({ hasNotes: !!d.notes, level: d.errataLevel, hasAnswer: !!d.answer, hasExplanation: !!d.explanation, hasImages: hasImgs,
    answerOpen: !!sh.answer, expOpen: !!sh.exp, answerView: sh.ansSrc === 'orig' ? 'orig' : 'text', expView: sh.expSrc === 'orig' ? 'orig' : 'text' });
  return at === kind ? errataHTML(d) : '';
}
function origHTML(d) {
  if (!d || !d.originalImages.length) return '';
  return `<div class="orig"><div class="lab">原图解析（源文件顺序，PDF 第 ${d.answerPdfPages} 页）</div>${d.originalImages.map(o => `<img src="${o.src}" style="width:${o.w}px" alt="原图解析" loading="lazy" data-zoom title="单击放大图片">`).join('')}</div>`;
}
function srcTabsHTML(kind, view) {
  const textLab = kind === 'exp' ? '文字解析' : '文字答案';
  const imgLab = kind === 'exp' ? '原图解析' : '原图答案';
  const act = kind === 'exp' ? 'expview' : 'ansview';
  const label = kind === 'exp' ? '解析视图' : '答案视图';
  const textOn = view !== 'orig';
  return `<div class="seg small src-tabs" role="tablist" aria-label="${label}" data-kind="${kind}">
    <button type="button" role="tab" data-act="${act}" data-view="text" aria-selected="${textOn}" tabindex="${textOn ? 0 : -1}" class="${textOn ? 'on' : ''}">${textLab}</button>
    <button type="button" role="tab" data-act="${act}" data-view="orig" aria-selected="${!textOn}" tabindex="${textOn ? -1 : 0}" class="${textOn ? '' : 'on'}">${imgLab}</button>
  </div>`;
}
function boxHTML(title, kind, id, body, tabs) {
  const hid = `src-panel-${kind}-${id}`;
  const hd = tabs ? `<div class="box-hd"><h4>${title}</h4>${tabs}</div>` : `<h4>${title}</h4>`;
  return `<section class="box" data-kind="${kind}">${hd}<div class="body" role="tabpanel" id="${hid}">${body}</div></section>`;
}
function focusSrcTab(id, act, view) {
  const el = document.querySelector(`.card[data-id="${id}"] button[data-act="${act}"][data-view="${view}"]`);
  if (el) el.focus();
}
function cardHTML(id, idx) {
  const q = byId.get(id), L = curList(), d = details.get(id);
  const paths = (L.categoryByQuestion[id] || q.categories);
  const leaf = (paths.find(p => !p.startsWith('历年真题')) || paths[0]).split(' / ').pop();
  const sh = st.show[id] || {}; const mk = store.rec.marks[id]?.state; const fav = store.rec.favorites.includes(id);
  const hl = st.q && st.q.length > 0 ? st.q : null;
  let ans = '';
  const hasImgs = !!(d && d.originalImages.length);
  if (sh.answer) {
    let body = '加载中', tabs = '';
    if (d) {
      const noteHTML = errataIn('answer', sh, d, hasImgs);
      if (d.answer && hasImgs) {
        const view = sh.ansSrc === 'orig' ? 'orig' : 'text';
        tabs = srcTabsHTML('answer', view);
        body = (view === 'orig' ? origHTML(d) : md(d.answer)) + noteHTML;
      } else if (d.answer) {
        body = md(d.answer) + noteHTML;
      } else {
        body = (sh.exp ? '<p class="muted">本题答案见下方「解析」中的原图。</p>' : origHTML(d)) + noteHTML;
      }
    }
    ans += boxHTML('答案', 'answer', id, body, tabs);
  }
  if (sh.exp) {
    let body = '加载中', tabs = '';
    if (d) {
      const noteHTML = errataIn('exp', sh, d, hasImgs);
      if (d.explanation && hasImgs) {
        const view = sh.expSrc === 'orig' ? 'orig' : 'text';
        tabs = srcTabsHTML('exp', view);
        body = (view === 'orig' ? origHTML(d) : md(d.explanation)) + noteHTML;
      } else {
        body = (d.explanation ? md(d.explanation) : '') + origHTML(d) + noteHTML;
      }
    }
    ans += boxHTML('解析', 'exp', id, body, tabs);
  }
  const hist = store.rec.history.filter(h => h.id === id);
  const srs = store.rec.srs[id], pv = store.previewMarks(id);
  const dueHTML = srs ? `<span class="due ${dayDiff(srs.card.due) <= 0 ? 'now' : ''}" title="FSRS 调度 · 已复习 ${srs.card.reps} 次">${fmtDue(srs.card.due)}</span>` : '<span class="due">未复习</span>';
  const hasNote = store.hasNote(id), noteOpen = !!sh.note;
  return `<article class="card" data-id="${id}">
    <div class="meta"><span class="qno">第 ${idx + 1} 题</span><span class="src">${esc(q.source)}</span>
      <span class="pop-wrap"><button type="button" class="cat-btn" data-act="cats" aria-expanded="false" aria-label="查看完整分类路径，共 ${paths.length} 处">${esc(leaf)}</button>
      <div class="popover catpop" hidden><b>分类路径</b>${paths.map(p => `<button type="button" data-act="gocat" data-path="${esc(p)}" title="查看本分类全部题目">${esc(p)}</button>`).join('')}</div></span>${hasNote ? `<span class="note-flag" title="本题有笔记">${IC.pen}有笔记</span>` : ''}${dueHTML}</div>
    <div class="stem">${md(q.stem, hl)}</div>
    <div class="actions">
      <button type="button" class="tog" data-act="answer" aria-pressed="${!!sh.answer}" aria-label="答案">${IC.eye}答案</button>
      <button type="button" class="tog" data-act="exp" aria-pressed="${!!sh.exp}" aria-label="解析">${IC.book}解析</button>
      <button type="button" class="tog" data-act="note" aria-pressed="${noteOpen}" aria-expanded="${noteOpen}" aria-label="${hasNote ? '笔记（已有笔记）' : '笔记'}">${IC.pen}笔记${hasNote ? '<i class="dot" aria-hidden="true"></i>' : ''}</button>
      <div class="marks">
        <button type="button" class="mk fav" data-act="fav" aria-pressed="${fav}" aria-label="${fav ? '取消收藏' : '收藏'}">${IC.star}${fav ? '已收藏' : '收藏'}</button>
        ${Object.entries(MARKS).map(([k, v]) => `<button type="button" class="mk" data-act="mark" data-mark="${k}" aria-pressed="${mk === k}" title="标记为${v}，下次复习 ${new Date(pv[k]).toLocaleDateString('zh-CN')}" aria-label="标记为${v}">${MARK_IC[k]}${v}<span class="iv">${ivl(pv[k])}</span></button>`).join('')}
      </div></div>
    ${mk ? `<button type="button" class="unmark" data-act="unmark">取消标记</button>` : ''}
    ${st.tab === 'retest' && hist.length ? `<details class="history"><summary>查看复测历史（${hist.length}）</summary><ul>${hist.slice().reverse().map(h => `<li>${new Date(h.at).toLocaleString('zh-CN')} · ${h.state ? MARKS[h.state] : '取消标记'}</li>`).join('')}</ul></details>` : ''}
    ${ans}${noteOpen ? noteHTMLFor(id, st.noteMode[id]) : ''}</article>`;
}

function renderCards(sec) {
  const el = $('#cards');
  if (!sec.length) { el.innerHTML = `<div class="empty">${st.q ? '没有匹配的题目' : st.tab === 'fav' ? '暂无收藏题目。点题目下方的「收藏」即可加入。' : st.tab === 'retest' ? (st.rv === 'due' ? '今日没有待复习的题目。评分后的题目会在到期当天出现在这里。' : '暂无复测题目。把题目标记为「不熟练」或「不会」后会出现在这里。') : '暂无题目'}</div>`; return; }
  const ids = store.rec.mode === 'multiple' ? sec : [st.qid];
  ids.forEach(id => { if ((st.show[id]?.answer || st.show[id]?.exp) && !details.has(id)) showDetail(id); });
  const a = document.activeElement, keep = a?.matches?.('textarea.note-input') ? { id: a.dataset.noteInput, s: a.selectionStart, e: a.selectionEnd, top: a.scrollTop } : null;
  el.innerHTML = ids.map(id => cardHTML(id, sec.indexOf(id))).join('');
  const ta = keep && el.querySelector(`textarea[data-note-input="${keep.id}"]`);
  if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(keep.s, keep.e); ta.scrollTop = keep.top; }
}
function renderPager(sec) {
  const prev = $('#prevBtn'), next = $('#nextBtn');
  const tops = sectionsAtDepth();
  const si = tops.indexOf(st.node);
  if (store.rec.mode === 'multiple') {
    $('#pos').textContent = sec.length ? `第 ${si + 1} / ${tops.length} 节 · ${sec.length} 题` : '0 / 0';
    prev.querySelector('span').textContent = '上一小节'; next.querySelector('span').textContent = '下一小节';
    prev.disabled = si <= 0; next.disabled = si < 0 || si >= tops.length - 1; return;
  }
  const i = sec.indexOf(st.qid);
  $('#pos').textContent = sec.length ? `${i + 1} / ${sec.length}` : '0 / 0';
  const atStart = i <= 0, atEnd = i >= sec.length - 1;
  prev.querySelector('span').textContent = atStart && si > 0 ? '上一小节' : '上一题';
  next.querySelector('span').textContent = atEnd && si >= 0 && si < tops.length - 1 ? '下一小节' : '下一题';
  prev.disabled = !sec.length || (atStart && si <= 0);
  next.disabled = !sec.length || (atEnd && (si < 0 || si >= tops.length - 1));
}
// 小节 = 与当前所选分类同一层级的分类（按目录顺序）
function sectionsAtDepth() {
  const depth = (st.node || '').split(' / ').length;
  return flatNodes(tree).filter(n => n.ids.length && n.path.split(' / ').length === depth).map(n => n.path);
}
function step(dir) {
  const sec = sectionIds(tree);
  const tops = sectionsAtDepth();
  const si = tops.indexOf(st.node);
  if (store.rec.mode === 'multiple') { const t = tops[si + dir]; if (t) { st.node = t; st.qid = null; render(); $('#main').scrollTo(0, 0); } return; }
  const i = sec.indexOf(st.qid);
  if (sec[i + dir] != null) st.qid = sec[i + dir];
  else { const t = tops[si + dir]; if (!t) return; st.node = t; const n = flatNodes(tree).find(x => x.path === t); st.qid = dir > 0 ? n.ids[0] : n.ids[n.ids.length - 1]; }
  render(); $('#main').scrollTo(0, 0);
}

async function showDetail(id) {
  try { await loadDetail(id); render(); } catch { toast('静态文件读取失败，请重试。'); }
}
// ---------- URL ----------
function syncURL() {
  const u = new URL(location.href); const p = u.searchParams;
  p.set('list', st.listId); st.qid != null ? p.set('question', st.qid) : p.delete('question');
  st.tab !== 'bank' ? p.set('tab', st.tab) : p.delete('tab');
  st.tab === 'retest' && st.rv !== 'due' ? p.set('rv', st.rv) : p.delete('rv');
  st.q ? p.set('q', st.q) : p.delete('q');
  st.node ? p.set('section', st.node) : p.delete('section');
  if (u.href !== location.href) history.replaceState(null, '', u);
}
export function readURL() {
  const p = new URLSearchParams(location.search);
  st.listId = lib.lists.some(l => l.id === p.get('list')) ? p.get('list') : 'complete';
  st.tab = ['bank', 'fav', 'retest'].includes(p.get('tab')) ? p.get('tab') : 'bank';
  st.qid = p.get('question') ? Number(p.get('question')) : null;
  st.q = p.get('q') || ''; $('#search').value = st.q;
  st.rv = p.get('rv') === 'marked' ? 'marked' : 'due';
  st.node = p.get('section') || null;
  if (st.qid != null && !st.node) {
    const paths = curList().categoryByQuestion[st.qid]; if (paths) st.node = paths[0].split(' / ')[0];
  }
}

function setMark(id, state) {
  const prev = store.markOf(id);
  store.setMark(id, state);
  if (st.tab === 'retest' && st.rv === 'due' && state) {
    const sec = sectionIds(tree); const i = sec.indexOf(id);
    if (store.isDueAfterToday(id)) { st.qid = sec[i + 1] ?? sec[i - 1] ?? null; toast(`已评分「${MARKS[state]}」，${fmtDue(store.rec.srs[id].card.due)}`); }
  } else if (st.tab === 'retest' && st.rv === 'marked' && !['shaky', 'unknown'].includes(state) && prev) {
    const sec = sectionIds(tree); const i = sec.indexOf(id); const nxt = sec[i + 1] ?? sec[i - 1] ?? null;
    st.qid = nxt; toast(state === 'mastered' ? '已掌握，已移出复测' : '已取消标记，已移出复测');
  }
  render();
}
export function bind() {
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.tab = b.dataset.tab; st.node = null; render(); });
  $('#brand').addEventListener('click', e => { e.preventDefault(); Object.assign(st, { tab: 'bank', listId: 'complete', node: null, qid: null, q: '' }); $('#search').value = ''; render(); $('#main').scrollTo(0, 0); });
  $('#tocBtn').addEventListener('click', () => { if (isMobile()) $('#app').classList.toggle('drawer-open'); else store.setPref('collapsed', !store.rec.collapsed); render(); });
  $('#scrim').addEventListener('click', () => { $('#app').classList.remove('drawer-open'); render(); });
  $('#listBtn').addEventListener('click', e => {
    e.stopPropagation(); const p = $('#listPop'); const open = p.hidden; closePops(); p.hidden = !open; $('#listBtn').setAttribute('aria-expanded', open);
    p.innerHTML = lib.lists.map(l => `<button type="button" role="option" data-list="${l.id}" aria-selected="${l.id === st.listId}"><span>${esc(l.name)} · ${l.questionIds.length} 题</span>${l.id === st.listId ? IC.check : ''}</button>`).join('');
  });
  $('#listPop').addEventListener('click', e => { const b = e.target.closest('button[data-list]'); if (!b) return; st.listId = b.dataset.list; st.node = null; st.qid = null; closePops(); render(); $('#main').scrollTo(0, 0); });
  $('#rvSeg').addEventListener('click', e => { const b = e.target.closest('button[data-rv]'); if (!b) return; st.rv = b.dataset.rv; st.node = null; st.qid = null; render(); });
  let sT; $('#search').addEventListener('input', e => { clearTimeout(sT); sT = setTimeout(() => { st.q = e.target.value.trim(); st.node = null; render(); }, 150); });
  $('#tree').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return; const path = b.closest('.node').dataset.path;
    if (b.dataset.act === 'toggle') { const n = b.closest('.node'); store.setOpen(path, !n.classList.contains('open')); renderTree(); return; }
    st.node = path; st.qid = null; store.setOpen(path, true); if (isMobile()) $('#app').classList.remove('drawer-open'); render(); $('#main').scrollTo(0, 0);
  });
  $('#cards').addEventListener('click', e => {
    const img = e.target.closest('img[data-zoom]'); if (img) { $('#lbImg').src = img.src; $('#lightbox').hidden = false; return; }
    const b = e.target.closest('button[data-act]'); if (!b) return; const id = Number(b.closest('.card').dataset.id);
    const sh = st.show[id] = st.show[id] || {};
    switch (b.dataset.act) {
      case 'answer': sh.answer = !sh.answer; break;
      case 'exp': sh.exp = !sh.exp; break;
      case 'ansview': sh.ansSrc = b.dataset.view; render(); focusSrcTab(id, 'ansview', sh.ansSrc); return;
      case 'expview': sh.expSrc = b.dataset.view; render(); focusSrcTab(id, 'expview', sh.expSrc); return;
      case 'note': { const open = !!sh.note; sh.note = !open; if (sh.note && !store.hasNote(id)) st.noteMode[id] = 'edit'; render(); if (sh.note) focusNote(id); return; }
      case 'nedit': st.noteMode[id] = 'edit'; render(); focusNote(id); return;
      case 'nprev': st.noteMode[id] = 'preview'; break;
      case 'nclear': {
        if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = '再点一次确认清空'; setTimeout(() => { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = '清空笔记'; } }, 3000); return; }
        clearNote(id); st.noteMode[id] = 'edit'; toast('已清空本题笔记'); break; }
      case 'fav': { const was = store.toggleFavorite(id); toast(was ? '已取消收藏' : '已收藏'); if (st.tab === 'fav' && was) { const sec = sectionIds(tree); const k = sec.indexOf(id); st.qid = sec[k + 1] ?? sec[k - 1] ?? null; } break; }
      case 'mark': return setMark(id, b.dataset.mark);
      case 'unmark': return setMark(id, null);
      case 'cats': { e.stopPropagation(); const p = b.nextElementSibling; const open = p.hidden; closePops(); p.hidden = !open; b.setAttribute('aria-expanded', open); return; }
      case 'gocat': st.tab = 'bank'; st.node = b.dataset.path; st.qid = id; store.setOpen(b.dataset.path.split(' / ')[0], true); closePops(); break;
    }
    render();
  });
  $('#cards').addEventListener('input', e => { if (e.target.matches('textarea.note-input')) onNoteInput(e.target); });
  $('#cards').addEventListener('focusout', e => { if (e.target.matches('textarea.note-input')) { const id = +e.target.dataset.noteInput; if (commitNote(id)) afterNoteSaved(id); } });
  $('#cards').addEventListener('dblclick', e => { const v = e.target.closest('.nb-view'); if (!v || e.target.closest('a')) return; const id = +v.closest('.card').dataset.id; st.noteMode[id] = 'edit'; render(); focusNote(id); });
  $('#cards').addEventListener('keydown', e => {
    if (e.target.matches('textarea.note-input') && (e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); const id = +e.target.dataset.noteInput; commitNote(id); afterNoteSaved(id); toast('笔记已保存'); return; }
    const tab = e.target.closest('.src-tabs button[role="tab"]');
    if (tab && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')) {
      e.preventDefault();
      const tabs = [...tab.parentElement.querySelectorAll('button[role="tab"]')];
      const i = tabs.indexOf(tab);
      const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.click();
    }
  });
  addEventListener('pagehide', () => flushNotes());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNotes(); });
  $('#prevBtn').addEventListener('click', () => step(-1));
  $('#nextBtn').addEventListener('click', () => step(1));
  $('#lightbox').addEventListener('click', () => $('#lightbox').hidden = true);
  document.addEventListener('click', e => { if (!e.target.closest('.popover')) closePops(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#lightbox').hidden = true; closePops(); return; }
    if (e.target.matches('input,textarea')) return;
    if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1);
  });
  addEventListener('resize', () => render());
  addEventListener('popstate', () => { readURL(); render(); });
}

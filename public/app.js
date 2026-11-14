/* 控制大观 · 静态版 */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const STORE = 'control-daguan:v1';
const MARKS = { shaky: '不熟练', unknown: '不会', mastered: '掌握' };
const FONT = [85, 100, 115, 130];
const IC = {
  eye: '<svg viewBox="0 0 24 24" class="ic"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  book: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M8 7h8"/></svg>',
  star: '<svg viewBox="0 0 24 24" class="ic"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
  gauge: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9"/><path d="m12 12 4-4"/></svg>',
  x: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
  ok: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" class="ic"><path d="m9 6 6 6-6 6"/></svg>',
  pen: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  check: '<svg viewBox="0 0 24 24" class="ic" style="width:12px;height:12px"><path d="m5 12 5 5 9-10"/></svg>',
};
const MARK_IC = { shaky: IC.gauge, unknown: IC.x, mastered: IC.ok };
// 标记 → FSRS 评分：不会=Again，不熟练=Hard，掌握=Good（不提供 Easy）
const F = window.FSRS;
const GRADE = { unknown: F.Rating.Again, shaky: F.Rating.Hard, mastered: F.Rating.Good };

// ---------- 存储：IndexedDB（idb-keyval），首次加载自动从 localStorage 迁移 ----------
const { CDGStore, CDGSync, CDGNotes } = window;
// 设置面板折叠分组；最近展开的一组记在本机偏好（不导出、不同步）
const SET_SECS = ['read', 'review', 'records', 'sync', 'offline', 'about'];
function normRec(r) {
  const ret = +r.retention;
  return { favorites: Array.isArray(r.favorites) ? r.favorites.map(Number) : [], marks: r.marks && typeof r.marks === 'object' ? r.marks : {},
    srs: normSrs(r.srs), retention: ret >= 0.8 && ret <= 0.95 ? Math.round(ret * 100) / 100 : 0.9, retentionAt: +r.retentionAt || 0,
    updated: r.updated && typeof r.updated === 'object' ? r.updated : {},
    history: Array.isArray(r.history) ? r.history : [], mode: r.mode === 'multiple' ? 'multiple' : 'single',
    fontScale: FONT.includes(r.fontScale) ? r.fontScale : 100, collapsed: !!r.collapsed, setSec: SET_SECS.includes(r.setSec) ? r.setSec : 'read', open: r.open && typeof r.open === 'object' ? r.open : {},
    notes: CDGNotes.normalize(r.notes) };
}
// srs: { [题号]: { card: FSRS 卡片（日期存 ISO 字符串）, logs: [复习日志] } }
function normSrs(s) {
  const out = {};
  if (!s || typeof s !== 'object') return out;
  for (const [k, v] of Object.entries(s)) {
    if (!v || typeof v !== 'object' || !v.card || isNaN(Date.parse(v.card.due))) continue;
    out[k] = { card: v.card, logs: Array.isArray(v.logs) ? v.logs.filter(l => l && l.id && l.review) : [] };
  }
  return out;
}
let rec = normRec({}), useLS = false;
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('control-daguan') : null;
async function persist() {
  if (useLS) { localStorage.setItem(STORE, JSON.stringify(rec)); return; }
  await CDGStore.set('rec', rec);
}
// 保存到本地；sync=true 时通知其他标签页并排队云同步
const save = (sync = true) => persist().then(() => { if (sync) { bc?.postMessage('rec'); gist?.schedule(); } }).catch(() => toast('浏览器未能保存进度，本次更改未保存，请重试。'));
const touch = id => { rec.updated[id] = Date.now(); };
async function loadRec() {
  let stored = null, legacy = null;
  try { const s = localStorage.getItem(STORE); if (s) legacy = normRec(JSON.parse(s)); } catch {}
  try { stored = await CDGStore.get('rec'); } catch { useLS = true; return legacy || normRec({}); }
  if (!legacy) return normRec(stored || {});
  // 迁移：localStorage 里的旧记录并入 IndexedDB（逐题取较新的一方），写入并读回确认后再删除旧键
  const merged = stored ? normRec({ ...normRec(stored), ...CDGSync.merge(normRec(stored), legacy) }) : legacy;
  await CDGStore.set('rec', merged);
  const back = await CDGStore.get('rec');
  if (back && CDGSync.canon(CDGSync.syncPart(back)) === CDGSync.canon(CDGSync.syncPart(merged))) { localStorage.removeItem(STORE); migrated = true; }
  return merged;
}
let migrated = false, gist = null;
// ---------- FSRS ----------
let sched, schedR;
const scheduler = () => { if (schedR !== rec.retention) { sched = F.fsrs(F.generatorParameters({ request_retention: rec.retention, enable_fuzz: false, enable_short_term: false })); schedR = rec.retention; } return sched; };
const toCard = c => ({ ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined });
const fromCard = c => ({ ...c, due: c.due.toISOString(), last_review: c.last_review ? new Date(c.last_review).toISOString() : undefined });
const cardOf = id => rec.srs[id] ? toCard(rec.srs[id].card) : F.createEmptyCard(new Date());
function preview(id) { const now = new Date(), r = scheduler().repeat(cardOf(id), now); const o = {}; for (const [k, g] of Object.entries(GRADE)) o[k] = r[g].card.due; return o; }
function review(id, mark) {
  const now = new Date(), r = scheduler().next(cardOf(id), now, GRADE[mark]);
  const e = rec.srs[id] || (rec.srs[id] = { card: null, logs: [] });
  e.card = fromCard(r.card);
  e.logs.push({ id: `${id}-${now.getTime()}`, rating: r.log.rating, mark, state: r.log.state, due: new Date(r.log.due).toISOString(), stability: r.log.stability,
    difficulty: r.log.difficulty, scheduled_days: r.log.scheduled_days, review: now.toISOString() });
}
// 复习按「学习日」计：凌晨 2 点前仍算前一天（熬夜复习不会提前把明天的题算进今天）
const DAY_CUT_H = 2;
const dayStart = d => { const x = new Date(+new Date(d) - DAY_CUT_H * 36e5); x.setHours(0, 0, 0, 0); return x; };
const endOfToday = () => { const d = dayStart(new Date()); d.setDate(d.getDate() + 1); d.setHours(DAY_CUT_H, 0, 0, 0); return new Date(d - 1); };
const dueIds = () => { const lim = endOfToday().getTime(); return Object.entries(rec.srs).filter(([k, v]) => byId.has(+k) && Date.parse(v.card.due) <= lim).sort((a, b) => Date.parse(a[1].card.due) - Date.parse(b[1].card.due) || a[0] - b[0]).map(([k]) => +k); };
const dayDiff = d => Math.round((dayStart(d) - dayStart(new Date())) / 864e5);
const ivl = d => { const n = Math.max(0, Math.round((new Date(d) - new Date()) / 864e5)); return n < 1 ? '今天' : n < 30 ? `${n}天` : n < 365 ? `${Math.round(n / 3) / 10}月` : `${Math.round(n / 36.5) / 10}年`; };
const fmtDue = d => { const n = dayDiff(d), dt = dayStart(d); const md = `${dt.getMonth() + 1}月${dt.getDate()}日`; return n < 0 ? `已到期 ${-n} 天（${md}）` : n === 0 ? `今日待复习（${md}）` : `下次复习：${md}（${n} 天后）`; };
bc && (bc.onmessage = async () => { rec = await loadRec(); render(); });

// ---------- 状态 ----------
let lib, byId = new Map(), details = new Map();
const st = { tab: 'bank', listId: 'complete', node: null, qid: null, q: '', page: 0, show: {}, rv: 'due', noteMode: {} };
const DUE_NODE = '今日待复习';

// ---------- 渲染工具 ----------
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
const md = (s, hl) => s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
  const h = inline(p.replace(/\n/g, ' '), hl);
  return /^<span class="fig">[^]*<\/span>$/.test(h) ? `<div class="fig">${h.replace(/^<span class="fig">|<\/span>$/g, '')}</div>` : `<p>${h}</p>`;
}).join('');

// ---------- 题目集合 ----------
const curList = () => lib.lists.find(l => l.id === st.listId) || lib.lists[0];
function scopeIds() {
  const L = curList(); let ids = L.questionIds;
  if (st.tab === 'fav') ids = ids.filter(id => rec.favorites.includes(id));
  if (st.tab === 'retest') ids = st.rv === 'due' ? dueIds().filter(id => ids.includes(id)) : ids.filter(id => ['shaky', 'unknown'].includes(rec.marks[id]?.state));
  if (st.q) { const k = st.q.toLowerCase(); ids = ids.filter(id => (byId.get(id).search + ' ' + (L.categoryByQuestion[id] || []).join(' ') + ' ' + (rec.notes[id]?.text || '')).toLowerCase().includes(k)); }
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
function render() {
  flushNotes();
  document.documentElement.style.setProperty('--fs', rec.fontScale / 100);
  const sec = ensureSelection();
  // tabs
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === st.tab));
  $('#app').classList.toggle('app-collapsed', rec.collapsed && !isMobile());
  $('#tocBtn').setAttribute('aria-expanded', isMobile() ? $('#app').classList.contains('drawer-open') : !rec.collapsed);
  $('#listBtn').parentElement.hidden = st.tab !== 'bank';
  $('#rvSeg').hidden = st.tab !== 'retest';
  document.querySelectorAll('#rvSeg button').forEach(b => b.classList.toggle('on', b.dataset.rv === st.rv));
  const nDue = dueIds().length, bd = $('#dueBadge'); bd.hidden = !nDue; bd.textContent = nDue; bd.title = `今日待复习 ${nDue} 题`;
  $('#retention').value = rec.retention; $('#retentionVal').textContent = rec.retention.toFixed(2);
  const L = curList();
  $('#listName').textContent = `${L.name} · ${L.questionIds.length} 题`;
  const node = st.node ? flatNodes(tree).find(n => n.path === st.node) : null;
  $('#sectionLabel').textContent = node ? `${st.q ? '搜索 · ' : ''}${st.tab === 'retest' ? '复测 · ' : ''}${node.name}  ${sec.length} 题` : (st.q ? `搜索「${st.q}」 0 题` : '');
  renderTree(); renderCards(sec); renderPager(sec); syncURL();
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === rec.mode));
  document.querySelectorAll('#fontSeg button').forEach(b => b.classList.toggle('on', +b.dataset.font === rec.fontScale));
  $('#accReadSum').textContent = `${rec.mode === 'multiple' ? '多题' : '单题'} · ${FONT_NAME[rec.fontScale] || '标准'}`;
  $('#accReviewSum').textContent = `记忆率 ${rec.retention.toFixed(2)}`;
}
const FONT_NAME = { 85: '小', 100: '标准', 115: '大', 130: '特大' };
function openSec(key) {
  document.querySelectorAll('#setBody .acc-btn').forEach(b => {
    const on = b.dataset.acc === key; b.setAttribute('aria-expanded', on); $('#' + b.getAttribute('aria-controls')).hidden = !on;
  });
}
const isMobile = () => matchMedia('(max-width:900px)').matches;

function renderTree() {
  const el = $('#tree');
  const markedCount = ids => ids.filter(id => rec.marks[id]).length;
  const nodeHTML = (n, depth) => {
    const open = rec.open[n.path] ?? (n.path === st.node || (st.node || '').startsWith(n.path + ' / '));
    const hasKids = n.list.length > 0;
    const cnt = st.tab === 'bank' ? `已标记 ${markedCount(n.ids)} / ${n.ids.length}` : `${n.ids.length} 题`;
    const selMark = n.path === st.node ? IC.check : '';
    const nn = n.ids.filter(id => CDGNotes.has(rec.notes, id)).length;
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
  const sh = st.show[id] || {}; const mk = rec.marks[id]?.state; const fav = rec.favorites.includes(id);
  const hl = st.q && st.q.length > 0 ? st.q : null;
  let ans = '';
  const noteHTML = errataHTML(d);
  const hasImgs = !!(d && d.originalImages.length);
  if (sh.answer) {
    let body = '加载中', tabs = '';
    if (d) {
      if (d.answer && hasImgs) {
        const view = sh.ansSrc === 'orig' ? 'orig' : 'text';
        tabs = srcTabsHTML('answer', view);
        body = view === 'orig' ? origHTML(d) : md(d.answer) + (!sh.exp ? noteHTML : '');
      } else if (d.answer) {
        body = md(d.answer) + (!sh.exp ? noteHTML : '');
      } else {
        body = (sh.exp ? '<p class="muted">本题答案见下方「解析」中的原图。</p>' : origHTML(d)) + (!sh.exp ? noteHTML : '');
      }
    }
    ans += boxHTML('答案', 'answer', id, body, tabs);
  }
  if (sh.exp) {
    let body = '加载中', tabs = '';
    if (d) {
      if (d.explanation && hasImgs) {
        const view = sh.expSrc === 'orig' ? 'orig' : 'text';
        tabs = srcTabsHTML('exp', view);
        body = view === 'orig' ? origHTML(d) : md(d.explanation) + noteHTML;
      } else {
        body = (d.explanation ? md(d.explanation) : '') + origHTML(d) + noteHTML;
      }
    }
    ans += boxHTML('解析', 'exp', id, body, tabs);
  }
  const hist = rec.history.filter(h => h.id === id);
  const srs = rec.srs[id], pv = preview(id);
  const dueHTML = srs ? `<span class="due ${dayDiff(srs.card.due) <= 0 ? 'now' : ''}" title="FSRS 调度 · 已复习 ${srs.card.reps} 次">${fmtDue(srs.card.due)}</span>` : '<span class="due">未复习</span>';
  const hasNote = CDGNotes.has(rec.notes, id), noteOpen = !!sh.note;
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
    ${ans}${noteOpen ? noteHTMLFor(id) : ''}</article>`;
}

// ---------- 笔记（每题一份，Markdown + 公式，自动保存） ----------
const drafts = new Map(); // 题号 → 尚未写入的草稿
const noteTimers = new Map();
const noteText = id => drafts.has(id) ? drafts.get(id) : (rec.notes[id]?.text || '');
const savedLabel = id => { const n = rec.notes[id]; return drafts.has(id) ? '正在保存…' : n?.text ? `已保存 · ${new Date(n.at).toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''; };
const EMPTY_NOTE = '<div class="nb-empty">还没有笔记。写下解题思路、易错点或公式推导，下次复习时一眼就能看到。</div>';
function noteHTMLFor(id) {
  const text = noteText(id), mode = st.noteMode[id] || (text.trim() ? 'preview' : 'edit');
  const head = `<div class="nb-head"><h4>${IC.pen}我的笔记</h4>
      <div class="seg small nb-tabs" role="tablist" aria-label="笔记视图"><button type="button" role="tab" data-act="nedit" aria-selected="${mode === 'edit'}" class="${mode === 'edit' ? 'on' : ''}">编辑</button><button type="button" role="tab" data-act="nprev" aria-selected="${mode === 'preview'}" class="${mode === 'preview' ? 'on' : ''}">预览</button></div>
      <span class="nb-status" role="status">${savedLabel(id)}</span></div>`;
  if (mode === 'preview') {
    const html = CDGNotes.render(text);
    return `<section class="box notebox" data-note="${id}">${head}<div class="md-body nb-view" title="双击编辑">${html || `${EMPTY_NOTE}<button type="button" class="btn soft nb-start" data-act="nedit">${IC.pen}写笔记</button>`}</div></section>`;
  }
  return `<section class="box notebox editing" data-note="${id}">${head}
    <div class="nb-split"><textarea class="note-input" data-note-input="${id}" rows="8" maxlength="${CDGNotes.MAX}" aria-label="第 ${id} 题笔记（Markdown）" placeholder="支持 Markdown：# 标题、**加粗**、- 列表、> 引用、\`代码\`、表格、[链接](https://…)\n公式：$G(s)=\\frac{K}{s(Ts+1)}$ 或独占一行的 $$…$$">${esc(text)}</textarea>
    <div class="md-body nb-live" aria-label="实时预览">${CDGNotes.render(text) || '<div class="nb-empty">实时预览会显示在这里。</div>'}</div></div>
    <div class="nb-foot"><span class="hint">支持 Markdown 与 $公式$ · 输入后自动保存</span>${text ? `<button type="button" class="nb-clear" data-act="nclear">清空笔记</button>` : ''}</div></section>`;
}
function commitNote(id) {
  clearTimeout(noteTimers.get(id)); noteTimers.delete(id);
  if (!drafts.has(id)) return false;
  const text = drafts.get(id); drafts.delete(id);
  const cur = rec.notes[id]?.text || '';
  if (text === cur) return false;
  if (!text && !rec.notes[id]) return false;
  // 本机编辑总是晚于它所基于的版本（防止设备间时钟偏差让刚写的内容被同步覆盖）
  const at = Math.max(Date.now(), (rec.notes[id]?.at || 0) + 1);
  rec.notes[id] = { text: text.trim() ? text : '', at };
  save().then(() => { if (rec.notes[id]?.at === at) dropBackup(id); });
  return true;
}
// 草稿同步备份到 localStorage：关页/崩溃时 IndexedDB 异步写入可能来不及完成，下次打开时恢复
const BK = 'control-daguan:note-draft:';
const backup = (id, text) => { try { localStorage.setItem(BK + id, JSON.stringify({ text, at: Math.max(Date.now(), (rec.notes[id]?.at || 0) + 1) })); } catch {} };
const dropBackup = id => { try { localStorage.removeItem(BK + id); } catch {} };
function restoreBackups() {
  let n = 0;
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(BK)) continue;
    const id = k.slice(BK.length);
    try {
      const d = JSON.parse(localStorage.getItem(k)), cur = rec.notes[id];
      if (byId.has(+id) && typeof d?.text === 'string' && d.at > (cur?.at || 0) && d.text !== (cur?.text || '')) { rec.notes[id] = { text: d.text.trim() ? d.text.slice(0, CDGNotes.MAX) : '', at: d.at }; n++; }
    } catch {}
    localStorage.removeItem(k);
  }
  return n;
}
function flushNotes() { let ch = false; for (const id of [...drafts.keys()]) ch = commitNote(id) || ch; return ch; }
// 只更新状态文字和题目标识，不重建卡片（避免打断输入）
function afterNoteSaved(id) {
  const sec = document.querySelector(`.notebox[data-note="${id}"]`); if (sec) sec.querySelector('.nb-status').textContent = savedLabel(id);
  const card = sec?.closest('.card'), has = CDGNotes.has(rec.notes, id);
  if (card) {
    const flag = card.querySelector('.note-flag');
    if (has && !flag) card.querySelector('.meta .due')?.insertAdjacentHTML('beforebegin', `<span class="note-flag" title="本题有笔记">${IC.pen}有笔记</span>`);
    if (!has && flag) flag.remove();
    const btn = card.querySelector('button[data-act="note"]'), dot = btn?.querySelector('.dot');
    if (has && btn && !dot) btn.insertAdjacentHTML('beforeend', '<i class="dot" aria-hidden="true"></i>'); if (!has) dot?.remove();
  }
  renderTree();
}
function onNoteInput(ta) {
  const id = +ta.dataset.noteInput; drafts.set(id, ta.value); backup(id, ta.value);
  const sec = ta.closest('.notebox'); sec.querySelector('.nb-status').textContent = '正在保存…';
  clearTimeout(noteTimers.get(id));
  noteTimers.set(id, setTimeout(() => { commitNote(id); afterNoteSaved(id); }, 700));
  clearTimeout(ta._pv); ta._pv = setTimeout(() => { const live = sec.querySelector('.nb-live'); if (live) live.innerHTML = CDGNotes.render(ta.value) || '<div class="nb-empty">实时预览会显示在这里。</div>'; }, 120);
}
function renderCards(sec) {
  const el = $('#cards');
  if (!sec.length) { el.innerHTML = `<div class="empty">${st.q ? '没有匹配的题目' : st.tab === 'fav' ? '暂无收藏题目。点题目下方的「收藏」即可加入。' : st.tab === 'retest' ? (st.rv === 'due' ? '今日没有待复习的题目。评分后的题目会在到期当天出现在这里。' : '暂无复测题目。把题目标记为「不熟练」或「不会」后会出现在这里。') : '暂无题目'}</div>`; return; }
  const ids = rec.mode === 'multiple' ? sec : [st.qid];
  ids.forEach(id => { if ((st.show[id]?.answer || st.show[id]?.exp) && !details.has(id)) loadDetail(id); });
  const a = document.activeElement, keep = a?.matches?.('textarea.note-input') ? { id: a.dataset.noteInput, s: a.selectionStart, e: a.selectionEnd, top: a.scrollTop } : null;
  el.innerHTML = ids.map(id => cardHTML(id, sec.indexOf(id))).join('');
  const ta = keep && el.querySelector(`textarea[data-note-input="${keep.id}"]`);
  if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(keep.s, keep.e); ta.scrollTop = keep.top; }
}
function renderPager(sec) {
  const prev = $('#prevBtn'), next = $('#nextBtn');
  const tops = sectionsAtDepth();
  const si = tops.indexOf(st.node);
  if (rec.mode === 'multiple') {
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
  if (rec.mode === 'multiple') { const t = tops[si + dir]; if (t) { st.node = t; st.qid = null; render(); $('#main').scrollTo(0, 0); } return; }
  const i = sec.indexOf(st.qid);
  if (sec[i + dir] != null) st.qid = sec[i + dir];
  else { const t = tops[si + dir]; if (!t) return; st.node = t; const n = flatNodes(tree).find(x => x.path === t); st.qid = dir > 0 ? n.ids[0] : n.ids[n.ids.length - 1]; }
  render(); $('#main').scrollTo(0, 0);
}

// ---------- 详情（答案/解析） ----------
async function loadDetail(id) {
  if (details.has(id)) return;
  try { const r = await fetch(`data/questions/${id}.json`); if (!r.ok) throw 0; details.set(id, await r.json()); render(); }
  catch { toast('静态文件读取失败，请重试。'); }
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
function readURL() {
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

// ---------- 记录导入导出 ----------
function setMsg(t, err) { const m = $('#setMsg'); m.textContent = t; m.classList.toggle('err', !!err); }
function exportJSON() {
  const data = { app: 'control-daguan', version: 2, exportedAt: new Date().toISOString(), favorites: rec.favorites, marks: rec.marks, history: rec.history, srs: rec.srs, retention: rec.retention, notes: rec.notes };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `control-daguan-records-${data.exportedAt.slice(0, 10)}.json`; $('#settings').appendChild(a); a.click(); a.remove();
  setMsg('已导出学习记录 JSON。');
}
function applyImport(d) {
  if (!d || d.app !== 'control-daguan' || !Array.isArray(d.favorites) || typeof d.marks !== 'object') throw new Error('不是有效的控制大观记录文件，请重新导出 JSON。');
  const known = id => byId.has(Number(id));
  const before = CDGSync.canon({ f: rec.favorites, m: rec.marks, s: rec.srs });
  const snap = id => CDGSync.canon([rec.favorites.includes(+id), rec.marks[id] || null, rec.srs[id] || null]);
  const prevSnap = Object.fromEntries([...byId.keys()].map(id => [id, snap(id)]));
  rec.favorites = [...new Set([...rec.favorites, ...d.favorites.map(Number).filter(known)])];
  for (const [k, v] of Object.entries(d.marks)) if (known(k) && v && MARKS[v.state] && (!rec.marks[k] || (v.at || 0) >= (rec.marks[k].at || 0))) rec.marks[k] = v;
  mergeSrs(rec.srs, normSrs(d.srs), known);
  flushNotes();
  if (d.notes) rec.notes = CDGNotes.merge(rec.notes, Object.fromEntries(Object.entries(CDGNotes.normalize(d.notes)).filter(([k]) => known(k))));
  if (CDGSync.canon({ f: rec.favorites, m: rec.marks, s: rec.srs }) !== before) for (const id of byId.keys()) if (snap(id) !== prevSnap[id]) touch(id);
  if (Array.isArray(d.history)) { const seen = new Set(rec.history.map(h => h.id + ':' + h.at)); d.history.forEach(h => { if (known(h.id) && !seen.has(h.id + ':' + h.at)) rec.history.push(h); }); rec.history.sort((a, b) => a.at - b.at); }
  save(); render();
}
// 每题取最近一次复习的卡片；复习日志按 id 去重合并（v1 记录没有 srs，原样跳过）
function mergeSrs(into, from, known = () => true) {
  for (const [k, v] of Object.entries(from)) {
    if (!known(k)) continue;
    const cur = into[k];
    if (!cur) { into[k] = { card: v.card, logs: [...v.logs] }; continue; }
    const t = c => Date.parse(c.last_review || 0) || 0;
    if (t(v.card) > t(cur.card)) cur.card = v.card;
    const ids = new Set(cur.logs.map(l => l.id)); v.logs.forEach(l => { if (!ids.has(l.id)) cur.logs.push(l); });
    cur.logs.sort((a, b) => Date.parse(a.review) - Date.parse(b.review));
  }
  return into;
}
// 记录码：CG1-<分段序号>/<总段数>-<base64url>-<校验>，校验为 FNV-1a 32 位
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function genCode() {
  // 记录码里每题只保留最近 20 条复习日志，控制长度
  const srs = Object.fromEntries(Object.entries(rec.srs).map(([k, v]) => [k, { card: v.card, logs: v.logs.slice(-20) }]));
  const payload = b64(JSON.stringify({ app: 'control-daguan', version: 2, favorites: rec.favorites, marks: rec.marks, history: rec.history.slice(-200), srs, retention: rec.retention, notes: rec.notes }));
  const batch = Date.now().toString(36), size = 400, parts = [];
  for (let i = 0; i < payload.length; i += size) parts.push(payload.slice(i, i + size));
  const code = parts.map((p, i) => `CG1-${batch}-${i + 1}/${parts.length}-${p}-${fnv(batch + i + p)}`).join('\n');
  $('#codeInput').value = code; $('#importCodeBtn').disabled = false;
  navigator.clipboard?.writeText(code).then(() => setMsg(`已生成 ${parts.length} 段记录码并复制到剪贴板。`), () => setMsg(`已生成 ${parts.length} 段记录码，请手动复制。`));
}
function importCode() {
  const segs = [...$('#codeInput').value.matchAll(/CG1-([0-9a-z]+)-(\d+)\/(\d+)-([A-Za-z0-9_-]+)-([0-9a-z]+)/g)];
  try {
    if (!segs.length) throw new Error('没有找到记录码，请粘贴以 CG1 开头的全部分段。');
    const batch = segs[0][1], total = +segs[0][3];
    if (segs.some(s => s[1] !== batch)) throw new Error('混入了不同批次的记录码，请使用同一组的全部分段。');
    const parts = []; segs.forEach(s => { if (fnv(batch + (s[2] - 1) + s[4]) !== s[5]) throw new Error(`第 ${s[2]} 段校验失败，请重新复制。`); parts[s[2] - 1] = s[4]; });
    if (parts.filter(Boolean).length !== total) throw new Error(`记录码不完整：需要 ${total} 段，只找到 ${parts.filter(Boolean).length} 段。`);
    applyImport(JSON.parse(unb64(parts.join('')))); setMsg('记录码校验通过，已导入。'); $('#codeInput').value = ''; $('#importCodeBtn').disabled = true;
  } catch (e) { setMsg(e.message || '记录码无效。', true); }
}

// ---------- 交互 ----------
let toastT; function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2200); }
function closePops(except) { document.querySelectorAll('.popover').forEach(p => { if (p !== except && !p.contains(except)) { p.hidden = true; const b = p.previousElementSibling; if (b?.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false'); } }); }
function focusNote(id) { const ta = document.querySelector(`textarea[data-note-input="${id}"]`); if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); ta.closest('.notebox').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
function setMark(id, state) {
  const prev = rec.marks[id]?.state;
  if (state) { rec.marks[id] = { state, at: Date.now() }; review(id, state); } else delete rec.marks[id];
  touch(id);
  rec.history.push({ id, state: state || null, at: Date.now() }); save();
  if (st.tab === 'retest' && st.rv === 'due' && state) {
    const sec = sectionIds(tree); const i = sec.indexOf(id);
    if (Date.parse(rec.srs[id].card.due) > endOfToday().getTime()) { st.qid = sec[i + 1] ?? sec[i - 1] ?? null; toast(`已评分「${MARKS[state]}」，${fmtDue(rec.srs[id].card.due)}`); }
  } else if (st.tab === 'retest' && st.rv === 'marked' && !['shaky', 'unknown'].includes(state) && prev) {
    const sec = sectionIds(tree); const i = sec.indexOf(id); const nxt = sec[i + 1] ?? sec[i - 1] ?? null;
    st.qid = nxt; toast(state === 'mastered' ? '已掌握，已移出复测' : '已取消标记，已移出复测');
  }
  render();
}
function bind() {
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.tab = b.dataset.tab; st.node = null; render(); });
  $('#brand').addEventListener('click', e => { e.preventDefault(); Object.assign(st, { tab: 'bank', listId: 'complete', node: null, qid: null, q: '' }); $('#search').value = ''; render(); $('#main').scrollTo(0, 0); });
  $('#tocBtn').addEventListener('click', () => { if (isMobile()) $('#app').classList.toggle('drawer-open'); else { rec.collapsed = !rec.collapsed; save(); } render(); });
  $('#scrim').addEventListener('click', () => { $('#app').classList.remove('drawer-open'); render(); });
  $('#gearBtn').addEventListener('click', e => { e.stopPropagation(); const p = $('#settings'); const open = p.hidden; closePops(); p.hidden = !open; $('#gearBtn').setAttribute('aria-expanded', open); setMsg(''); if (open) openSec(rec.setSec); });
  // 折叠分组：同一时间只展开一组；再点已展开的标题可收起；↑↓/Home/End 在标题间移动
  $('#setBody').addEventListener('click', e => { const b = e.target.closest('.acc-btn'); if (!b) return; const on = b.getAttribute('aria-expanded') === 'true'; openSec(on ? null : b.dataset.acc); if (!on) { rec.setSec = b.dataset.acc; save(false); } });
  $('#setBody').addEventListener('keydown', e => {
    const b = e.target.closest('.acc-btn'); if (!b) return; const all = [...document.querySelectorAll('.acc-btn')], i = all.indexOf(b);
    const j = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key]; if (j === undefined) return;
    e.preventDefault(); all[(j + all.length) % all.length].focus();
  });
  $('#listBtn').addEventListener('click', e => {
    e.stopPropagation(); const p = $('#listPop'); const open = p.hidden; closePops(); p.hidden = !open; $('#listBtn').setAttribute('aria-expanded', open);
    p.innerHTML = lib.lists.map(l => `<button type="button" role="option" data-list="${l.id}" aria-selected="${l.id === st.listId}"><span>${esc(l.name)} · ${l.questionIds.length} 题</span>${l.id === st.listId ? IC.check : ''}</button>`).join('');
  });
  $('#listPop').addEventListener('click', e => { const b = e.target.closest('button[data-list]'); if (!b) return; st.listId = b.dataset.list; st.node = null; st.qid = null; closePops(); render(); $('#main').scrollTo(0, 0); });
  $('#settings').addEventListener('click', e => {
    e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { rec.mode = b.dataset.mode; save(); render(); }
    if (b.dataset.font) { rec.fontScale = +b.dataset.font; save(); render(); }
  });
  $('#exportBtn').addEventListener('click', exportJSON);
  $('#syncConnectBtn').addEventListener('click', async () => {
    const tok = $('#gistToken').value; $('#syncConnectBtn').disabled = true; setMsg('正在连接 GitHub…');
    try { await gist.connect(tok); $('#gistToken').value = ''; setMsg('已连接，进度会自动同步到你的私密 Gist。'); }
    catch (e) { setMsg(e.message || '连接失败。', true); }
    finally { $('#syncConnectBtn').disabled = false; }
  });
  $('#syncNowBtn').addEventListener('click', () => gist.sync().then(r => r && setMsg(r.pulled || r.pushed ? `同步完成：${[r.pulled && '已拉取远端改动', r.pushed && '已上传本地改动'].filter(Boolean).join('，')}。` : '同步完成：两边已一致。'), e => setMsg(e.message, true)));
  $('#syncOffBtn').addEventListener('click', async () => { await gist.disconnect(); setMsg('已断开同步，本机记录保留；令牌已从本机删除，Gist 仍在你的 GitHub 账号里。'); });
  $('#retention').addEventListener('input', e => { rec.retention = Math.round(+e.target.value * 100) / 100; $('#retentionVal').textContent = rec.retention.toFixed(2); });
  $('#retention').addEventListener('change', () => { rec.retentionAt = Date.now(); save(); render(); setMsg(`目标记忆率已设为 ${rec.retention.toFixed(2)}。`); });
  $('#resetSrsBtn').addEventListener('click', () => { $('#resetConfirm').hidden = false; $('#resetSrsBtn').hidden = true; });
  $('#resetNo').addEventListener('click', () => { $('#resetConfirm').hidden = true; $('#resetSrsBtn').hidden = false; });
  $('#resetYes').addEventListener('click', () => { Object.keys(rec.srs).forEach(touch); rec.srs = {}; save(); $('#resetConfirm').hidden = true; $('#resetSrsBtn').hidden = false; render(); setMsg('已重置复习进度，标记和收藏保留。'); });
  $('#rvSeg').addEventListener('click', e => { const b = e.target.closest('button[data-rv]'); if (!b) return; st.rv = b.dataset.rv; st.node = null; st.qid = null; render(); });
  $('#genCodeBtn').addEventListener('click', genCode);
  $('#codeInput').addEventListener('input', e => $('#importCodeBtn').disabled = !e.target.value.trim());
  $('#importCodeBtn').addEventListener('click', importCode);
  $('#importJsonBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg('记录文件超过 10 MB，请选择导出的学习记录 JSON。', true);
    try { applyImport(JSON.parse(await f.text())); setMsg('已导入学习记录 JSON。'); } catch (err) { setMsg(err instanceof SyntaxError ? '无法读取 JSON，请重新选择完整的学习记录文件。' : err.message, true); }
  });
  let sT; $('#search').addEventListener('input', e => { clearTimeout(sT); sT = setTimeout(() => { st.q = e.target.value.trim(); st.node = null; render(); }, 150); });
  $('#tree').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return; const path = b.closest('.node').dataset.path;
    if (b.dataset.act === 'toggle') { const n = b.closest('.node'); rec.open[path] = !n.classList.contains('open'); save(); renderTree(); return; }
    st.node = path; st.qid = null; rec.open[path] = true; save(); if (isMobile()) $('#app').classList.remove('drawer-open'); render(); $('#main').scrollTo(0, 0);
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
      case 'note': { const open = !!sh.note; sh.note = !open; if (sh.note && !CDGNotes.has(rec.notes, id)) st.noteMode[id] = 'edit'; render(); if (sh.note) focusNote(id); return; }
      case 'nedit': st.noteMode[id] = 'edit'; render(); focusNote(id); return;
      case 'nprev': st.noteMode[id] = 'preview'; break;
      case 'nclear': {
        if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = '再点一次确认清空'; setTimeout(() => { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = '清空笔记'; } }, 3000); return; }
        drafts.set(id, ''); commitNote(id); st.noteMode[id] = 'edit'; toast('已清空本题笔记'); break; }
      case 'fav': { const i = rec.favorites.indexOf(id); i >= 0 ? rec.favorites.splice(i, 1) : rec.favorites.push(id); touch(id); save(); toast(i >= 0 ? '已取消收藏' : '已收藏'); if (st.tab === 'fav' && i >= 0) { const sec = sectionIds(tree); const k = sec.indexOf(id); st.qid = sec[k + 1] ?? sec[k - 1] ?? null; } break; }
      case 'mark': return setMark(id, rec.marks[id]?.state === b.dataset.mark ? rec.marks[id].state : b.dataset.mark);
      case 'unmark': return setMark(id, null);
      case 'cats': { e.stopPropagation(); const p = b.nextElementSibling; const open = p.hidden; closePops(); p.hidden = !open; b.setAttribute('aria-expanded', open); return; }
      case 'gocat': st.tab = 'bank'; st.node = b.dataset.path; st.qid = id; rec.open[b.dataset.path.split(' / ')[0]] = true; save(); closePops(); break;
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

// ---------- 启动 ----------
Promise.all([fetch('data/library.json').then(r => { if (!r.ok) throw 0; return r.json(); }), loadRec()]).then(async ([d, r]) => {
  lib = d; d.questions.forEach(q => byId.set(q.id, q)); rec = r;
  if (restoreBackups()) save();
  readURL(); bind(); render();
  if (migrated) toast('学习记录已迁移到 IndexedDB');
  await initSync();
  window.CDGPWA?.start({ getLib: () => lib, flush: async () => { flushNotes(); await persist(); } });
}).catch(() => { $('#cards').innerHTML = '<div class="empty">静态文件读取失败，请刷新重试。</div>'; });

// ---------- 云同步（GitHub Gist，可选） ----------
function syncUI(cfg, busy, pending) {
  const on = !!cfg?.token;
  $('#syncOff').hidden = on; $('#syncOn').hidden = !on;
  $('#accSyncSum').textContent = !on ? '未连接' : busy ? '同步中…' : cfg.lastError ? '同步失败' : '已连接';
  $('#accSyncSum').classList.toggle('err', on && !busy && !!cfg.lastError);
  if (!on) return;
  const el = $('#syncStatus');
  const last = cfg.lastSync ? new Date(cfg.lastSync).toLocaleString('zh-CN', { hour12: false }) : '尚未同步';
  el.classList.toggle('err', !!cfg.lastError);
  el.textContent = busy ? '正在同步…' : cfg.lastError ? `同步失败：${cfg.lastError}` : `已同步 · ${last}${pending ? '（有改动待同步）' : ''}`;
  $('#syncMeta').textContent = `最近成功同步：${last}${cfg.gistId ? ` · Gist ${cfg.gistId.slice(0, 7)}…` : ''}`;
  const extra = cfg.scopes && cfg.scopes.split(',').map(s => s.trim()).filter(s => s && s !== 'gist');
  $('#syncWarn').hidden = !extra?.length; if (extra?.length) $('#syncWarn').textContent = `提醒：这个令牌还带有 ${extra.join('、')} 权限，建议换成只勾选 gist 的令牌。`;
  $('#syncNowBtn').disabled = !!busy;
}
async function initSync() {
  gist = new CDGSync.GistSync({
    getLocal: () => rec,
    applyMerged: async m => { rec = normRec({ ...rec, ...m }); await save(false); bc?.postMessage('rec'); render(); },
    onStatus: syncUI,
  });
  try { await gist.init(); } catch { return; }
  if (gist.connected) gist.sync().catch(() => {});
  addEventListener('online', () => { if (gist.connected) gist.sync().catch(() => {}); });
  addEventListener('offline', () => { if (gist.connected) gist.saveCfg({ lastError: '当前离线，联网后自动同步。', errorKind: 'offline' }); });
}

})();

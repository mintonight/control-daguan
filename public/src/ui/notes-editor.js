/* 笔记编辑器：每题一份 Markdown 笔记，输入后防抖自动保存；草稿先同步备份到 localStorage。 */
import * as store from '../store/records.js';
import { NOTE_MAX } from '../core/merge.js';
import { renderNote } from './note-markdown.js';
import { IC } from './icons.js';
import { html, setHTML, insertHTML } from './html.js';
import { after, debounce } from '../core/timers.js';

const hooks = { noteSaved: () => {} };
/** noteSaved：笔记写入后（用于刷新目录里的笔记计数） */
export const setNoteHooks = h => Object.assign(hooks, h);
const drafts = new Map(); // 题号 → 尚未写入的草稿
const NOTE_SAVE_MS = 700, PREVIEW_MS = 120, CLEAR_CONFIRM_MS = 3000;
const noteTimers = new Map(); // 题号 → 取消待执行的自动保存
const previews = new WeakMap(); // textarea → 防抖的实时预览
const clearArmed = new Map(); // 题号 → 取消「再点一次确认清空」的超时复位
const noteText = id => drafts.has(id) ? drafts.get(id) : (store.noteOf(id)?.text || '');
const savedLabel = id => { const n = store.noteOf(id); return drafts.has(id) ? '正在保存…' : n?.text ? `已保存 · ${new Date(n.at).toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''; };
const EMPTY_NOTE = html`<div class="nb-empty">还没有笔记。写下解题思路、易错点或公式推导，下次复习时一眼就能看到。</div>`;
const EMPTY_LIVE = html`<div class="nb-empty">实时预览会显示在这里。</div>`;
// 「清空笔记」两步确认：第一次点击进入待确认状态，CLEAR_CONFIRM_MS 内再点才清空；状态跨重绘保留
const CLEAR_LABEL = { idle: '清空笔记', armed: '再点一次确认清空' };
const clearBtn = id => { const armed = clearArmed.has(id); return html`<button type="button" class="nb-clear${armed ? ' confirm' : ''}" data-act="nclear">${CLEAR_LABEL[armed ? 'armed' : 'idle']}</button>`; };
const paintClear = id => { const b = document.querySelector(`.notebox[data-note="${id}"] .nb-clear`); if (!b) return; const armed = clearArmed.has(id); b.classList.toggle('confirm', armed); b.textContent = CLEAR_LABEL[armed ? 'armed' : 'idle']; };
/** 返回 true 表示应当清空（已在确认状态）；否则进入确认状态并返回 false */
export function confirmClear(id) {
  if (clearArmed.has(id)) { clearArmed.get(id)(); clearArmed.delete(id); return true; }
  clearArmed.set(id, after(CLEAR_CONFIRM_MS, () => { clearArmed.delete(id); paintClear(id); }, { idle: false }));
  paintClear(id); return false;
}
/** 笔记框；mode 未指定时有内容显示预览、没有内容显示编辑器 */
export function noteHTMLFor(id, mode) {
  const text = noteText(id); mode = mode || (text.trim() ? 'preview' : 'edit');
  const head = html`<div class="nb-head"><h4>${IC.pen}我的笔记</h4>
      <div class="seg small nb-tabs" role="tablist" aria-label="笔记视图"><button type="button" role="tab" data-act="nedit" aria-selected="${mode === 'edit'}" class="${mode === 'edit' ? 'on' : ''}">编辑</button><button type="button" role="tab" data-act="nprev" aria-selected="${mode === 'preview'}" class="${mode === 'preview' ? 'on' : ''}">预览</button></div>
      <span class="nb-status" role="status">${savedLabel(id)}</span></div>`;
  if (mode === 'preview') {
    const body = renderNote(text);
    return html`<section class="box notebox" data-note="${id}">${head}<div class="md-body nb-view" title="双击编辑">${body || html`${EMPTY_NOTE}<button type="button" class="btn soft nb-start" data-act="nedit">${IC.pen}写笔记</button>`}</div></section>`;
  }
  return html`<section class="box notebox editing" data-note="${id}">${head}
    <div class="nb-split"><textarea class="note-input" data-note-input="${id}" rows="8" maxlength="${NOTE_MAX}" aria-label="第 ${id} 题笔记（Markdown）" placeholder="支持 Markdown：# 标题、**加粗**、- 列表、> 引用、\`代码\`、表格、[链接](https://…)\n公式：$G(s)=\\frac{K}{s(Ts+1)}$ 或独占一行的 $$…$$">${text}</textarea>
    <div class="md-body nb-live" aria-label="实时预览">${renderNote(text) || EMPTY_LIVE}</div></div>
    <div class="nb-foot"><span class="hint">支持 Markdown 与 $公式$ · 输入后自动保存</span>${text ? clearBtn(id) : ''}</div></section>`;
}
/** 把草稿写入记录；没有草稿或内容没变时返回 false */
export function commitNote(id) {
  noteTimers.get(id)?.(); noteTimers.delete(id);
  if (!drafts.has(id)) return false;
  const text = drafts.get(id); drafts.delete(id);
  const cur = store.noteOf(id);
  if (text === (cur?.text || '')) return false;
  if (!text && !cur) return false;
  store.saveNote(id, text);
  return true;
}
export const clearNote = id => { drafts.set(id, ''); commitNote(id); };
export function flushNotes() { let ch = false; for (const id of [...drafts.keys()]) ch = commitNote(id) || ch; return ch; }
// 只更新状态文字和题目标识，不重建卡片（避免打断输入）
export function afterNoteSaved(id) {
  const sec = document.querySelector(`.notebox[data-note="${id}"]`); if (sec) sec.querySelector('.nb-status').textContent = savedLabel(id);
  const card = sec?.closest('.card'), has = store.hasNote(id);
  if (card) {
    const flag = card.querySelector('.note-flag');
    const due = card.querySelector('.meta .due');
    if (has && !flag && due) insertHTML(due, 'beforebegin', html`<span class="note-flag" title="本题有笔记">${IC.pen}有笔记</span>`);
    if (!has && flag) flag.remove();
    const btn = card.querySelector('button[data-act="note"]'), dot = btn?.querySelector('.dot');
    if (has && btn && !dot) insertHTML(btn, 'beforeend', html`<i class="dot" aria-hidden="true"></i>`); if (!has) dot?.remove();
  }
  hooks.noteSaved();
}
export function onNoteInput(ta) {
  const id = +ta.dataset.noteInput; drafts.set(id, ta.value); store.backupDraft(id, ta.value);
  const sec = ta.closest('.notebox'); sec.querySelector('.nb-status').textContent = '正在保存…';
  noteTimers.get(id)?.();
  noteTimers.set(id, after(NOTE_SAVE_MS, () => { noteTimers.delete(id); commitNote(id); afterNoteSaved(id); }));
  if (!previews.has(ta)) previews.set(ta, debounce(() => { const live = ta.closest('.notebox')?.querySelector('.nb-live'); if (live) setHTML(live, renderNote(ta.value) || EMPTY_LIVE); }, PREVIEW_MS));
  previews.get(ta)();
}
export function focusNote(id) { const ta = document.querySelector(`textarea[data-note-input="${id}"]`); if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); ta.closest('.notebox').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }

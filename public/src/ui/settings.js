/* 设置面板：阅读偏好、复习、学习记录导入导出与记录码、云同步、关于。 */
import * as store from '../store/records.js';
import { $, closePops } from './dom.js';
import { flushNotes } from './notes-editor.js';

const hooks = { render: () => {} };
export function openSec(key) {
  document.querySelectorAll('#setBody .acc-btn').forEach(b => {
    const on = b.dataset.acc === key; b.setAttribute('aria-expanded', on); $('#' + b.getAttribute('aria-controls')).hidden = !on;
  });
}
function setMsg(t, err) { const m = $('#setMsg'); m.textContent = t; m.classList.toggle('err', !!err); }
function exportJSON() {
  const data = store.exportData();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `control-daguan-records-${data.exportedAt.slice(0, 10)}.json`; $('#settings').appendChild(a); a.click(); a.remove();
  setMsg('已导出学习记录 JSON。');
}
function applyImport(d) { flushNotes(); store.importRecords(d); hooks.render(); }
// 记录码：CG1-<分段序号>/<总段数>-<base64url>-<校验>，校验为 FNV-1a 32 位
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function genCode() {
  const payload = b64(JSON.stringify(store.codeData()));
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
export function syncUI(cfg, busy, pending) {
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
/** render：设置改动后重绘主界面 */
export function bindSettings(h) {
  Object.assign(hooks, h);
  $('#gearBtn').addEventListener('click', e => { e.stopPropagation(); const p = $('#settings'); const open = p.hidden; closePops(); p.hidden = !open; $('#gearBtn').setAttribute('aria-expanded', open); setMsg(''); if (open) openSec(store.rec.setSec); });
  // 折叠分组：同一时间只展开一组；再点已展开的标题可收起；↑↓/Home/End 在标题间移动
  $('#setBody').addEventListener('click', e => { const b = e.target.closest('.acc-btn'); if (!b) return; const on = b.getAttribute('aria-expanded') === 'true'; openSec(on ? null : b.dataset.acc); if (!on) store.setPref('setSec', b.dataset.acc); });
  $('#setBody').addEventListener('keydown', e => {
    const b = e.target.closest('.acc-btn'); if (!b) return; const all = [...document.querySelectorAll('.acc-btn')], i = all.indexOf(b);
    const j = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key]; if (j === undefined) return;
    e.preventDefault(); all[(j + all.length) % all.length].focus();
  });
  $('#settings').addEventListener('click', e => {
    e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { store.setPref('mode', b.dataset.mode); hooks.render(); }
    if (b.dataset.font) { store.setPref('fontScale', +b.dataset.font); hooks.render(); }
  });
  $('#exportBtn').addEventListener('click', exportJSON);
  $('#syncConnectBtn').addEventListener('click', async () => {
    const tok = $('#gistToken').value; $('#syncConnectBtn').disabled = true; setMsg('正在连接 GitHub…');
    try { await store.connectSync(tok); $('#gistToken').value = ''; setMsg('已连接，进度会自动同步到你的私密 Gist。'); }
    catch (e) { setMsg(e.message || '连接失败。', true); }
    finally { $('#syncConnectBtn').disabled = false; }
  });
  $('#syncConnectBtn').addEventListener('click', async () => {
    const tok = $('#gistToken').value; $('#syncConnectBtn').disabled = true; setMsg('正在连接 GitHub…');
    try { await store.connectSync(tok); $('#gistToken').value = ''; setMsg('已连接，进度会自动同步到你的私密 Gist。'); }
    catch (e) { setMsg(e.message || '连接失败。', true); }
    finally { $('#syncConnectBtn').disabled = false; }
  });
  $('#syncNowBtn').addEventListener('click', () => store.syncNow().then(r => r && setMsg(r.pulled || r.pushed ? `同步完成：${[r.pulled && '已拉取远端改动', r.pushed && '已上传本地改动'].filter(Boolean).join('，')}。` : '同步完成：两边已一致。'), e => setMsg(e.message, true)));
  $('#syncOffBtn').addEventListener('click', async () => { await store.disconnectSync(); setMsg('已断开同步，本机记录保留；令牌已从本机删除，Gist 仍在你的 GitHub 账号里。'); });
  $('#syncOffBtn').addEventListener('click', async () => { await store.disconnectSync(); setMsg('已断开同步，本机记录保留；令牌已从本机删除，Gist 仍在你的 GitHub 账号里。'); });
  $('#retention').addEventListener('input', e => { store.previewRetention(+e.target.value); $('#retentionVal').textContent = store.rec.retention.toFixed(2); });
  $('#retention').addEventListener('change', () => { store.commitRetention(); hooks.render(); setMsg(`目标记忆率已设为 ${store.rec.retention.toFixed(2)}。`); });
  $('#resetSrsBtn').addEventListener('click', () => { $('#resetConfirm').hidden = false; $('#resetSrsBtn').hidden = true; });
  $('#resetNo').addEventListener('click', () => { $('#resetConfirm').hidden = true; $('#resetSrsBtn').hidden = false; });
  $('#resetYes').addEventListener('click', () => { store.resetSrs(); $('#resetConfirm').hidden = true; $('#resetSrsBtn').hidden = false; hooks.render(); setMsg('已重置复习进度，标记和收藏保留。'); });
  $('#genCodeBtn').addEventListener('click', genCode);
  $('#codeInput').addEventListener('input', e => $('#importCodeBtn').disabled = !e.target.value.trim());
  $('#importCodeBtn').addEventListener('click', importCode);
  $('#importJsonBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg('记录文件超过 10 MB，请选择导出的学习记录 JSON。', true);
    try { applyImport(JSON.parse(await f.text())); setMsg('已导入学习记录 JSON。'); } catch (err) { setMsg(err instanceof SyntaxError ? '无法读取 JSON，请重新选择完整的学习记录文件。' : err.message, true); }
  });
  $('#codeInput').addEventListener('input', e => $('#importCodeBtn').disabled = !e.target.value.trim());
  $('#importCodeBtn').addEventListener('click', importCode);
  $('#importJsonBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg('记录文件超过 10 MB，请选择导出的学习记录 JSON。', true);
    try { applyImport(JSON.parse(await f.text())); setMsg('已导入学习记录 JSON。'); } catch (err) { setMsg(err instanceof SyntaxError ? '无法读取 JSON，请重新选择完整的学习记录文件。' : err.message, true); }
  });
  $('#importCodeBtn').addEventListener('click', importCode);
  $('#importJsonBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg('记录文件超过 10 MB，请选择导出的学习记录 JSON。', true);
    try { applyImport(JSON.parse(await f.text())); setMsg('已导入学习记录 JSON。'); } catch (err) { setMsg(err instanceof SyntaxError ? '无法读取 JSON，请重新选择完整的学习记录文件。' : err.message, true); }
  });
  $('#importJsonBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg('记录文件超过 10 MB，请选择导出的学习记录 JSON。', true);
    try { applyImport(JSON.parse(await f.text())); setMsg('已导入学习记录 JSON。'); } catch (err) { setMsg(err instanceof SyntaxError ? '无法读取 JSON，请重新选择完整的学习记录文件。' : err.message, true); }
  });
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setMsg('记录文件超过 10 MB，请选择导出的学习记录 JSON。', true);
    try { applyImport(JSON.parse(await f.text())); setMsg('已导入学习记录 JSON。'); } catch (err) { setMsg(err instanceof SyntaxError ? '无法读取 JSON，请重新选择完整的学习记录文件。' : err.message, true); }
  });
}

/* 安装（PWA）、Service Worker 注册与更新提示、离线下载。 */
import { $ } from './dom.js';
import { after } from '../core/timers.js';

const IMG_RE = /img\/[A-Za-z0-9._/-]+/g;

let deferred = null;
let hooks = { getLib: null, flush: async () => {} };
let waitingToReload = false;
let sizeLabel = '';
let registrationTask, maintenance;
let shellReady = false;

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
}
function isIOSSafari() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS && /WebKit/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}
function fmtBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace(/\.0$/, '') + ' KB';
  return (n / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' MB';
}
function updateInstallUI() {
  const installed = isStandalone();
  const canInstall = !installed && !!deferred;
  const top = $('#installTopBtn'), btn = $('#installBtn'), hint = $('#installHint'), already = $('#installedHint');
  if (top) top.hidden = !canInstall;
  if (btn) btn.hidden = !canInstall;
  if (hint) hint.hidden = installed || canInstall || !isIOSSafari();
  if (already) already.hidden = !installed;
  updateSum();
}
function updateSum() {
  const el = $('#accOfflineSum'); if (!el) return;
  const parts = [];
  if (isStandalone()) parts.push('已安装');
  else if (deferred) parts.push('可安装');
  parts.push(sizeLabel || '未下载');
  el.textContent = parts.join(' · ');
}
function deadline(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const cancel = after(ms, () => reject(new Error(message)), { idle: false });
    promise.then(value => { cancel(); resolve(value); }, error => { cancel(); reject(error); });
  });
}
async function controlledWorker() {
  if (!registrationTask) throw new Error('浏览器不支持离线功能');
  const reg = await deadline(registrationTask, 20000, '离线功能未就绪，请联网重试');
  const valid = () => navigator.serviceWorker.controller?.scriptURL === new URL('sw.js', reg.scope).href;
  if (valid()) return navigator.serviceWorker.controller;
  await new Promise((resolve, reject) => {
    const changed = () => { if (valid()) { cleanup(); resolve(); } };
    const cancel = after(20000, () => { cleanup(); reject(new Error('离线功能未就绪，请等更新完成后重试')); }, { idle: false });
    const cleanup = () => { cancel(); navigator.serviceWorker.removeEventListener('controllerchange', changed); };
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    changed();
  });
  return navigator.serviceWorker.controller;
}
async function workerCall(type, payload = {}, worker) {
  const target = worker || await controlledWorker();
  const channel = new MessageChannel();
  try {
    return await deadline(new Promise((resolve, reject) => {
      channel.port1.onmessage = event => event.data?.ok ? resolve(event.data) : reject(new Error(event.data?.error || '离线缓存操作失败'));
      target.postMessage({ type, ...payload }, [channel.port2]);
    }), 30000, '离线缓存核验超时，请联网重试');
  } finally { channel.port1.close(); }
}
async function storageLabel() {
  try { return await navigator.storage?.persisted?.() ? '已获持久存储保护' : '浏览器仍可能回收缓存'; }
  catch { return '存储保护状态未知'; }
}
async function showHealth(ready, error = '') {
  shellReady = ready;
  const el = $('#offlineHealth');
  if (el) el.textContent = `${ready ? '离线入口：已核验' : '离线入口：未就绪'} · ${error || await storageLabel()}`;
}
async function refreshSize(status) {
  try {
    status = status || await workerCall('OFFLINE_STATUS');
    sizeLabel = status.bytes ? fmtBytes(status.bytes) : '未下载';
    const el = $('#offlineSize');
    if (el) el.textContent = status.bytes ? `离线缓存：${fmtBytes(status.bytes)}（${status.files} 个文件）` : '离线缓存：未下载';
    const clear = $('#offlineClearBtn');
    if (clear) clear.disabled = !status.bytes;
    await showHealth(status.shellReady);
  } catch (error) {
    sizeLabel = '状态未知';
    await showHealth(false, error.message);
  }
  updateSum();
}
function maintainOffline() {
  if (!maintenance) maintenance = workerCall('ENSURE_OFFLINE').then(refreshSize).catch(async error => {
    await showHealth(false, error.message);
    // Old assets may no longer be on the server; a new complete worker can replace them.
    registrationTask?.then(reg => reg.update()).catch(() => {});
  }).finally(() => { maintenance = null; });
  return maintenance;
}

async function promptInstall() {
  if (!deferred || !deferred.prompt) return;
  const ev = deferred;
  deferred = null;
  updateInstallUI();
  try { await ev.prompt(); await ev.userChoice; } catch {}
}

function showUpdateToast() {
  const el = $('#updateToast');
  if (el) el.hidden = false;
}

async function applyUpdate() {
  try { await hooks.flush(); } catch {}
  waitingToReload = true;
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}

function collectFrom(obj, into) {
  if (typeof obj === 'string') {
    const m = obj.match(IMG_RE);
    if (m) m.forEach(u => into.add(u));
  } else if (Array.isArray(obj)) obj.forEach(v => collectFrom(v, into));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach(v => collectFrom(v, into));
}

async function mapPool(items, limit, fn) {
  const q = items.slice();
  const workers = Array.from({ length: Math.min(limit, q.length) || 0 }, async () => {
    while (q.length) {
      const item = q.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function downloadAll() {
  const lib = hooks.getLib && hooks.getLib();
  if (!lib || !lib.questions) { setProg('题库尚未加载完成，请稍后再试。'); return; }
  // Ask only after the user's explicit offline-download gesture, never at startup.
  const protection = navigator.storage?.persist?.().catch(() => false);
  const btn = $('#offlineDlBtn'), bar = $('#offlineBar'), wrap = $('#offlineProg'), text = $('#offlineProgText');
  if (btn) btn.disabled = true;
  if (wrap) wrap.hidden = false;
  setProg('正在核验离线入口…');
  try {
    const worker = await controlledWorker();
    const status = await workerCall('ENSURE_OFFLINE', {}, worker);
    if (!status.shellReady) throw new Error('离线入口不完整，请先完成应用更新');
    const urls = new Set();
    collectFrom(lib, urls);
    lib.questions.forEach(q => urls.add(`data/questions/${q.id}.json`));
    const list = [...urls], seen = new Set(list), extra = [], failed = [];
    let done = 0, total = list.length;
    const tick = () => {
      if (bar) bar.style.width = Math.min(100, Math.round(done / total * 100)) + '%';
      if (text) text.textContent = `正在下载并核验 ${done} / ${total}${failed.length ? `（失败 ${failed.length}）` : ''}`;
    };
    const download = async url => {
      try {
        const result = await workerCall('CACHE_RUNTIME', { url }, worker);
        if (result.json) {
          const more = new Set(); collectFrom(result.json, more);
          more.forEach(path => { if (!seen.has(path)) { seen.add(path); extra.push(path); } });
        }
      } catch (error) { failed.push(`${url}：${error.message}`); }
      done++; tick();
    };
    tick();
    await mapPool(list, 6, download);
    total += extra.length; tick();
    await mapPool(extra, 6, download);
    await protection;
    const verified = await workerCall('VERIFY_RUNTIME', { urls: [...seen] }, worker);
    await refreshSize();
    if (verified.missing.length) throw new Error(`最终核验发现 ${verified.missing.length} 个文件缺失，请联网重试`);
    if (!shellReady) throw new Error('入口核验失败，尚不能保证离线使用');
    if (text) text.textContent = failed.length ? `下载未完成：${failed.length} 个文件失败，已有缓存已保留。可联网重试。${failed[0]}` : `已全部缓存并逐项核验（${total} 个文件，${sizeLabel}）。`;
    if (bar) bar.style.width = `${Math.round((total - failed.length) / total * 100)}%`;
  } catch (error) {
    setProg(`离线下载失败：${error.message}。已有缓存和学习记录未清除。`);
    await showHealth(shellReady, error.message);
  } finally { if (btn) btn.disabled = false; }
}

function setProg(msg) {
  const wrap = $('#offlineProg'), text = $('#offlineProgText');
  if (wrap) wrap.hidden = false;
  if (text) text.textContent = msg;
}

async function clearRuntime() {
  await refreshSize(await workerCall('CLEAR_RUNTIME'));
  const bar = $('#offlineBar'), text = $('#offlineProgText'), wrap = $('#offlineProg');
  if (bar) bar.style.width = '0%';
  if (wrap) wrap.hidden = true;
  if (text) text.textContent = '';
}

function bindUI() {
  $('#installTopBtn')?.addEventListener('click', promptInstall);
  $('#installBtn')?.addEventListener('click', promptInstall);
  $('#updateToast')?.addEventListener('click', applyUpdate);
  $('#offlineDlBtn')?.addEventListener('click', downloadAll);
  $('#acc-offline-btn')?.addEventListener('click', () => { refreshSize(); });
  $('#offlineClearBtn')?.addEventListener('click', () => {
    $('#offlineClearBtn').hidden = true;
    $('#offlineClearConfirm').hidden = false;
  });
  $('#offlineClearNo')?.addEventListener('click', () => {
    $('#offlineClearConfirm').hidden = true;
    $('#offlineClearBtn').hidden = false;
  });
  $('#offlineClearYes')?.addEventListener('click', async () => {
    try { await clearRuntime(); } catch (error) { setProg(`清除失败：${error.message}`); }
    $('#offlineClearConfirm').hidden = true;
    $('#offlineClearBtn').hidden = false;
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const onInstalled = w => {
    if (!w) return;
    w.addEventListener('statechange', () => {
      if (w.state !== 'installed') return;
      if (navigator.serviceWorker.controller) showUpdateToast();
      else w.postMessage({ type: 'SKIP_WAITING' });
    });
  };
  registrationTask = navigator.serviceWorker.register('sw.js', { scope: './' }).then(reg => {
    if (reg.waiting) {
      if (navigator.serviceWorker.controller) showUpdateToast();
      else reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    onInstalled(reg.installing);
    reg.addEventListener('updatefound', () => onInstalled(reg.installing));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { reg.update().catch(() => {}); maintainOffline(); }
    });
    return reg;
  });
  registrationTask.catch(error => showHealth(false, `注册失败：${error.message}`));
  addEventListener('online', maintainOffline);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (waitingToReload) location.reload();
    else maintainOffline();
  });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferred = e;
  updateInstallUI();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  updateInstallUI();
});
try {
  matchMedia('(display-mode: standalone)').addEventListener('change', updateInstallUI);
} catch {}

bindUI();
updateInstallUI();
registerSW();
refreshSize();

/** getLib()：当前题库（离线下载用）；flush()：更新前先把未保存的笔记写入 */
export function startPWA(opts) {
  if (opts) Object.assign(hooks, opts);
  maintainOffline();
}

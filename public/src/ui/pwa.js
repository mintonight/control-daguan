/* 安装（PWA）、Service Worker 注册与更新提示、离线下载。 */
import { $ } from './dom.js';

const RUNTIME = 'cdg-runtime';
const IMG_RE = /img\/[A-Za-z0-9._/-]+/g;

let deferred = null;
let hooks = { getLib: null, flush: async () => {} };
let waitingToReload = false;
let sizeLabel = '';

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
async function runtimeSize() {
  if (!('caches' in window)) return 0;
  if (!(await caches.has(RUNTIME))) return 0;
  const cache = await caches.open(RUNTIME);
  let n = 0;
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (res) n += (await res.blob()).size;
  }
  return n;
}
async function refreshSize() {
  try {
    const n = await runtimeSize();
    sizeLabel = n ? fmtBytes(n) : '未下载';
    const el = $('#offlineSize');
    if (el) el.textContent = n ? `离线缓存：${fmtBytes(n)}` : '离线缓存：未下载';
    const clear = $('#offlineClearBtn');
    if (clear) clear.disabled = !n;
  } catch {
    sizeLabel = '';
  }
  updateSum();
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
  const btn = $('#offlineDlBtn'), bar = $('#offlineBar'), wrap = $('#offlineProg'), text = $('#offlineProgText');
  if (btn) btn.disabled = true;
  if (wrap) wrap.hidden = false;
  const urls = new Set();
  collectFrom(lib, urls);
  lib.questions.forEach(q => urls.add(`data/questions/${q.id}.json`));
  const list = [...urls];
  let done = 0, failed = 0;
  const totalGuess = list.length;
  const tick = (total) => {
    const n = total || totalGuess;
    if (bar) bar.style.width = Math.min(100, Math.round(done / n * 100)) + '%';
    if (text) text.textContent = failed ? `正在下载 ${done} / ${n}（失败 ${failed}）` : `正在下载 ${done} / ${n}`;
  };
  tick();
  const seen = new Set(list);
  const addExtra = [];
  await mapPool(list, 6, async url => {
    try {
      const r = await fetch(url);
      if (!r.ok) throw 0;
      if (url.endsWith('.json')) {
        try {
          const more = new Set();
          collectFrom(await r.json(), more);
          more.forEach(u => { if (!seen.has(u)) { seen.add(u); addExtra.push(u); } });
        } catch {}
      } else {
        await r.blob();
      }
    } catch { failed++; }
    done++; tick();
  });
  const extra = addExtra.slice();
  const total = list.length + extra.length;
  tick(total);
  await mapPool(extra, 6, async url => {
    try {
      const r = await fetch(url);
      if (!r.ok) throw 0;
      await r.blob();
    } catch { failed++; }
    done++; tick(total);
  });
  await refreshSize();
  if (text) text.textContent = failed ? `已缓存，其中 ${failed} 个文件失败。` : `已全部缓存（${sizeLabel || fmtBytes(await runtimeSize())}）。`;
  if (bar) bar.style.width = '100%';
  if (btn) btn.disabled = false;
}
function setProg(msg) {
  const wrap = $('#offlineProg'), text = $('#offlineProgText');
  if (wrap) wrap.hidden = false;
  if (text) text.textContent = msg;
}

async function clearRuntime() {
  if ('caches' in window && await caches.has(RUNTIME)) await caches.delete(RUNTIME);
  const bar = $('#offlineBar'), text = $('#offlineProgText'), wrap = $('#offlineProg');
  if (bar) bar.style.width = '0%';
  if (wrap) wrap.hidden = true;
  if (text) text.textContent = '';
  await refreshSize();
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
    await clearRuntime();
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
  navigator.serviceWorker.register('sw.js', { scope: './' }).then(reg => {
    if (reg.waiting) {
      if (navigator.serviceWorker.controller) showUpdateToast();
      else reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    onInstalled(reg.installing);
    reg.addEventListener('updatefound', () => onInstalled(reg.installing));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (waitingToReload) location.reload();
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
refreshSize();
registerSW();

/** getLib()：当前题库（离线下载用）；flush()：更新前先把未保存的笔记写入 */
export function startPWA(opts) {
  if (opts) Object.assign(hooks, opts);
  refreshSize();
}

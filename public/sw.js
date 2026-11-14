/* 控制大观 · Service Worker */
'use strict';

// PRECACHE 由 tools/build_precache.py 在构建时写入，请勿手改
const PRECACHE = {
  "version": "b3c40575d757",
  "files": [
    "./",
    "./index.html",
    "./app.js",
    "./app.css",
    "./notes.js",
    "./sync.js",
    "./pwa.js",
    "./manifest.webmanifest",
    "./data/library.json",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png",
    "./icons/icon-192.png",
    "./icons/icon-512-maskable.png",
    "./icons/icon-512.png",
    "./vendor/dompurify/LICENSE",
    "./vendor/dompurify/purify.min.js",
    "./vendor/idb-keyval/LICENCE",
    "./vendor/idb-keyval/idb-keyval.umd.js",
    "./vendor/katex/README.md",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.woff",
    "./vendor/katex/fonts/KaTeX_AMS-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff",
    "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Main-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_Main-Bold.woff",
    "./vendor/katex/fonts/KaTeX_Main-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.ttf",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff",
    "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2",
    "./vendor/katex/fonts/KaTeX_Main-Italic.ttf",
    "./vendor/katex/fonts/KaTeX_Main-Italic.woff",
    "./vendor/katex/fonts/KaTeX_Main-Italic.woff2",
    "./vendor/katex/fonts/KaTeX_Main-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Main-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Main-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.ttf",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff",
    "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2",
    "./vendor/katex/fonts/KaTeX_Math-Italic.ttf",
    "./vendor/katex/fonts/KaTeX_Math-Italic.woff",
    "./vendor/katex/fonts/KaTeX_Math-Italic.woff2",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.ttf",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff",
    "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.ttf",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff",
    "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff",
    "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Script-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Script-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Script-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size1-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size2-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size3-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Size4-Regular.woff2",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.ttf",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff",
    "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2",
    "./vendor/katex/katex.min.css",
    "./vendor/katex/katex.min.js",
    "./vendor/marked/LICENSE.md",
    "./vendor/marked/marked.umd.js",
    "./vendor/ts-fsrs/LICENSE",
    "./vendor/ts-fsrs/ts-fsrs.umd.js"
  ]
};

const SHELL = 'cdg-shell-' + PRECACHE.version;
const RUNTIME = 'cdg-runtime';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(PRECACHE.files);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('cdg-') && k !== SHELL && k !== RUNTIME)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 跨域请求（含 api.github.com、Gist）一律不拦截、不缓存
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNav(req));
    return;
  }

  const path = url.pathname;
  if (path.includes('/data/questions/') || path.includes('/img/')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function networkFirstNav(req) {
  try {
    return await fetch(req);
  } catch {
    const hit = await caches.match(req) ||
      await caches.match('./index.html', { ignoreSearch: true }) ||
      await caches.match('./');
    return hit || new Response('离线不可用', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  const fetching = fetch(req).then(async res => {
    if (res && res.ok) await cache.put(req, res.clone());
    return res;
  }).catch(() => undefined);
  if (cached) return cached;
  const fresh = await fetching;
  return fresh || new Response('', { status: 503, statusText: 'offline' });
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    return await fetch(req);
  } catch {
    return new Response('', { status: 503, statusText: 'offline' });
  }
}

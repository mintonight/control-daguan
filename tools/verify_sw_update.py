"""Same-origin upgrade from the exact item-9 worker; real HTTP install failures, no sleeps."""
import asyncio
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import socket
import tempfile
import threading
from urllib.parse import urlsplit

from build_precache import build
from verify_support import idle

ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/control-daguan/'


class UpgradeHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        path = urlsplit(self.path).path
        mode = self.server.faults.get(path)
        if mode == 'missing':
            self.send_error(404)
            return
        if mode == 'interrupted':
            self.connection.shutdown(socket.SHUT_RDWR)
            self.connection.close()
            return
        if mode == 'mismatch':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'HTTP 200, but not the generated asset bytes')
            return
        # The test models a deployment, never an accidental Last-Modified/304 shortcut.
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


async def update_state(page):
    return await asyncio.wait_for(page.evaluate("""async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const settled = new Promise(resolve => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          const changed = () => {
            if (worker.state === 'installed' || worker.state === 'redundant') resolve(worker.state);
          };
          worker.addEventListener('statechange', changed); changed();
        }, {once: true});
      });
      await registration.update();
      return settled;
    }"""), timeout=45)


async def snapshot(page, name):
    return await page.evaluate("""async name => {
      const cache = await caches.open(name), out = {};
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        out[request.url] = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
      }
      return out;
    }""", name)


async def cold_launch(context, page, base):
    await page.close()
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    net = await context.new_cdp_session(page)
    await net.send('Network.enable')
    await net.send('Network.clearBrowserCache')
    await net.detach()
    await context.set_offline(True)
    await page.goto(base + '?list=complete&question=202401', wait_until='domcontentloaded')
    await page.wait_for_selector('.card[data-id="202401"]')
    await idle(page)
    return page, errors


async def verify_upgrade(pw, ok):
    with tempfile.TemporaryDirectory(prefix='cdg-sw-upgrade-') as tmp:
        site = Path(tmp) / 'control-daguan'
        shutil.copytree(ROOT / 'public', site)
        # This is the unmodified prior committed worker, including its real cache name/list.
        shutil.copyfile(ROOT / 'tests/fixtures/sw-v9.js', site / 'sw.js')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(UpgradeHandler, directory=tmp))
        server.faults = {}
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_address[1]}{PREFIX}'
        context = await pw.chromium.launch_persistent_context(
            str(Path(tmp) / 'profile'), executable_path='/usr/bin/google-chrome')
        try:
            page = context.pages[0]
            await page.goto(base, wait_until='domcontentloaded')
            await page.wait_for_function('!!navigator.serviceWorker.controller')
            await idle(page)
            old_key = 'cdg-shell-f5f6edb998f1'
            keys = await page.evaluate('() => caches.keys()')
            ok('升级基线：原提交 4b6c934 的 SW 已在同源真实安装', old_key in keys, keys)
            before = await snapshot(page, old_key)
            old_css = (site / 'app.css').read_text(encoding='utf-8')
            await page.evaluate("""async () => {
              const cache = await caches.open('cdg-runtime');
              await cache.put('data/questions/upgrade-sentinel.json', new Response('preserve runtime'));
            }""")

            # Upgrade to the exact current artifact, not a hand-edited/synthetic worker.
            new_source = (ROOT / 'public/sw.js').read_text(encoding='utf-8')
            (site / 'sw.js').write_text(new_source, encoding='utf-8')
            manifest = build(site)
            new_key = 'cdg-shell-' + manifest['version']
            ok('旧 SW 升级到当前构建产物：字节完全匹配且缓存版本不同', new_key != old_key and (site / 'sw.js').read_bytes() == (ROOT / 'public/sw.js').read_bytes(), new_key)

            for mode in ['missing', 'interrupted', 'mismatch']:
                server.faults[PREFIX + 'icons/favicon-32.png'] = mode
                state = await update_state(page)
                keys = await page.evaluate('() => caches.keys()')
                untouched = before == await snapshot(page, old_key)
                served_css = await page.evaluate("() => fetch('app.css').then(r => r.text())")
                ok(f'安装失败 {mode}：拒绝新 SW、移除候选缓存、旧缓存逐字节不变', state == 'redundant' and new_key not in keys and untouched and served_css == old_css, f'state={state}, caches={keys}')
                assert state == 'redundant', 'failed candidate must not activate'

            page, errors = await cold_launch(context, page, base)
            ok('失败更新后清除 HTTP 缓存、关闭旧页面，仍可离线冷启动', not errors and await page.locator('.card[data-id="202401"]').count() == 1, errors)
            await context.set_offline(False)
            server.faults.clear()
            state = await update_state(page)
            await page.wait_for_selector('#updateToast:not([hidden])')
            staged = await snapshot(page, new_key)
            expected = {base + url[2:]: base64.b64decode(value.split('-', 1)[1]).hex() for url, value in manifest['integrity'].items()}
            ok('成功安装等待激活：整个候选缓存与生成清单哈希一致，旧缓存未变', state == 'installed' and staged == expected and before == await snapshot(page, old_key), f'{len(staged)} assets')
            async with page.expect_navigation(wait_until='domcontentloaded'):
                await page.locator('#updateToast').click()
            await page.wait_for_function("keys => caches.keys().then(names => names.includes(keys.newKey) && !names.includes(keys.oldKey))", arg={'newKey': new_key, 'oldKey': old_key})
            await idle(page)
            preserved = await page.evaluate("() => caches.open('cdg-runtime').then(c => c.match('data/questions/upgrade-sentinel.json')).then(r => r && r.text())")
            ok('同源点击更新：当前版本激活、旧壳清除、原运行时缓存保留', preserved == 'preserve runtime', preserved)
            server.shutdown()
            page, errors = await cold_launch(context, page, base)
            cached = await snapshot(page, new_key)
            ok('升级后停服、清除 HTTP 缓存、关闭旧页面，离线冷启动当前版本', not errors and cached == expected, f'cache={new_key}, errors={errors}')
        finally:
            await context.close()
            server.shutdown()
            server.server_close()

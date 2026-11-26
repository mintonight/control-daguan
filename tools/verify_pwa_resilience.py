"""Offline recovery regressions. All mutation is confined to temporary sites and fresh browser profiles."""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile
import threading

from build_precache import build
from verify_support import launch_chromium

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'control-daguan:%2Fcontrol-daguan%2F:'
RUNTIME = PREFIX + 'runtime'

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

async def offline_settings(page):
    await page.locator('#gearBtn').click()
    await page.locator('#acc-offline-btn').click()

async def verify_resilience(pw, ok):
    with tempfile.TemporaryDirectory(prefix='cdg-offline-regression-') as tmp:
        root = Path(tmp)
        for path in ['control-daguan', 'mirror']:
            shutil.copytree(ROOT / 'public', root / path)
        css = root / 'mirror/app.css'
        css.write_text(css.read_text() + '\n/* isolated second-scope build */\n')
        manifest = build(root / 'control-daguan')
        build(root / 'mirror')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=tmp))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}/'
        browser = await launch_chromium(pw)
        try:
            ctx = await browser.new_context()
            await ctx.route('**/sw.js', lambda route: route.abort())
            page = await ctx.new_page()
            await page.goto(base + 'control-daguan/', wait_until='networkidle')
            await offline_settings(page)
            await page.locator('#offlineDlBtn').click()
            await page.wait_for_function("/已|失败|无法|未就绪/.test(document.querySelector('#offlineProgText').textContent)")
            result = await page.locator('#offlineProgText').inner_text()
            ok('SW 注册失败时下载如实报错，不能假报全部缓存', '已全部缓存' not in result and bool(result), result)
            await ctx.close()

            ctx = await browser.new_context()
            pa = await ctx.new_page()
            await pa.goto(base + 'control-daguan/', wait_until='networkidle')
            await pa.wait_for_function('!!navigator.serviceWorker.controller')
            # Seed an old shared runtime without deleting anything; migration must preserve foreign scope data too.
            await pa.evaluate("""async () => {
                const legacy = await caches.open('cdg-runtime');
                await legacy.put('/control-daguan/img/migration-marker', new Response('legacy own'));
                await legacy.put('/mirror/img/foreign-marker', new Response('legacy foreign'));
                await __cdg.kv.set('forensic-test', 'keep IDB');
            }""")
            # Restart the installed worker's maintenance using the real offline readiness command.
            try:
                responded = await asyncio.wait_for(pa.evaluate("""() => new Promise(resolve => {
                    const channel = new MessageChannel();
                    channel.port1.onmessage = e => { channel.port1.close(); resolve(e.data.ok); };
                    navigator.serviceWorker.controller.postMessage({type:'ENSURE_OFFLINE'}, [channel.port2]);
                })"""), timeout=10)
            except asyncio.TimeoutError:
                responded = False
            migration = await pa.evaluate("""async runtime => {
                const own = await fetch('/control-daguan/img/migration-marker');
                return {own: own.ok && await own.text(), foreign: !!await (await caches.open('cdg-runtime')).match('/mirror/img/foreign-marker')};
            }""", RUNTIME)
            migration['responded'] = responded
            ok('旧下载按 scope 直接可读，不以批量迁移阻塞且保留其他 scope 数据', migration['responded'] and migration['own'] == 'legacy own' and migration['foreign'], migration)
            keys = await pa.evaluate('caches.keys()')
            original = next(k for k in keys if 'shell-' in k)
            pb = await ctx.new_page()
            await pb.goto(base + 'mirror/', wait_until='networkidle')
            await pb.wait_for_function('!!navigator.serviceWorker.controller')
            after = await pb.evaluate('caches.keys()')
            ok('同 origin 另一 scope 安装新构建不删除原应用外壳', original in after, after)
            await ctx.set_offline(True)
            response = await pa.goto(base + 'control-daguan/?scope-test', wait_until='domcontentloaded')
            if response.status == 200:
                await pa.wait_for_selector('.card')
            ok('另一 scope 激活后原应用仍可离线进入', response.status == 200 and await pa.locator('.card').count() == 1, await pa.locator('body').inner_text() if response.status != 200 else '')
            await ctx.set_offline(False)
            await ctx.close()

            # Download must wait for installation/control, not race ahead through ordinary network fetches.
            ctx = await browser.new_context()
            release = asyncio.Event()
            async def hold_worker(route):
                await release.wait()
                await route.continue_()
            await ctx.route('**/sw.js', hold_worker)
            page = await ctx.new_page()
            await page.goto(base + 'control-daguan/', wait_until='domcontentloaded')
            await page.wait_for_selector('.card')
            await offline_settings(page)
            await page.locator('#offlineDlBtn').click()
            waiting = await page.locator('#offlineProgText').inner_text()
            ok('SW 未就绪时下载保持等待，不提前宣称完成', '核验' in waiting and await page.locator('#offlineDlBtn').is_disabled() and not await page.evaluate('!!navigator.serviceWorker.controller'), waiting)
            release.set()
            await page.wait_for_function("/已全部缓存|下载未完成|下载失败/.test(document.querySelector('#offlineProgText').textContent)", timeout=90000)
            downloaded = await page.locator('#offlineProgText').inner_text()
            entries = await page.evaluate("async name => (await (await caches.open(name)).keys()).length", RUNTIME)
            ok('控制权建立后全量下载逐项写入并核验完成', '已全部缓存并逐项核验' in downloaded and entries > 300, f'{downloaded}; entries={entries}')
            await ctx.close()

            # Simulate cache loss only inside this fresh test context. No personal/browser profile is used.
            ctx = await browser.new_context()
            page = await ctx.new_page()
            await page.goto(base + 'control-daguan/', wait_until='networkidle')
            await page.wait_for_function('!!navigator.serviceWorker.controller')
            await page.evaluate("""async () => {
                for (const name of await caches.keys()) if (name.includes('shell-')) await caches.delete(name);
                await __cdg.kv.set('forensic-test', 'record survives');
            }""")
            await page.goto(base + 'control-daguan/?recover', wait_until='networkidle')
            complete = await page.evaluate("""async urls => {
                for (const url of urls) if (!await caches.match(new URL(url, location.href).href)) return false;
                return true;
            }""", manifest['files'])
            ok('外壳丢失后联网重开自动补齐全部必需文件', complete)
            await ctx.set_offline(True)
            response = await page.goto(base + 'control-daguan/?recovered-offline', wait_until='domcontentloaded')
            if response.status == 200:
                await page.wait_for_selector('.card')
            ok('自动恢复后可断网冷导航，学习记录未改动', response.status == 200 and await page.locator('.card').count() == 1 and await page.evaluate("__cdg.kv.get('forensic-test')") == 'record survives' if response.status == 200 else False, response.status)
            await ctx.close()
        finally:
            await browser.close()
            server.shutdown()
            server.server_close()

async def verify_live(pw, base, directory, ok):
    """Public deployed assets, isolated test profile. No signed-in profile or account data is used."""
    directory.mkdir(parents=True, exist_ok=True)
    browser = await launch_chromium(pw)
    context = await browser.new_context(viewport={'width': 1440, 'height': 900})
    try:
        page = await context.new_page()
        await page.goto(base + '?list=complete&question=202501', wait_until='networkidle')
        await page.wait_for_function('!!navigator.serviceWorker.controller')
        await offline_settings(page)
        await page.locator('#offlineDlBtn').click()
        await page.wait_for_function("/已全部缓存|下载未完成|下载失败/.test(document.querySelector('#offlineProgText').textContent)", timeout=180000)
        text = await page.locator('#offlineProgText').inner_text()
        ok('线上下载全部文件并完成写入核验', '已全部缓存并逐项核验' in text, text)
        await page.screenshot(path=str(directory / 'download-desktop.png'), full_page=True)
        runtime = await page.evaluate("() => navigator.serviceWorker.getRegistration().then(r => 'control-daguan:' + encodeURIComponent(new URL(r.scope).pathname) + ':runtime')")
        before = await page.evaluate("async name => (await (await caches.open(name)).keys()).length", runtime)
        await page.evaluate('() => navigator.serviceWorker.getRegistration().then(r => r.update())')
        after = await page.evaluate("async name => (await (await caches.open(name)).keys()).length", runtime)
        ok('线上检查 SW 更新不丢已下载资源', before > 300 and after >= before, f'{before} -> {after}')
        await context.set_offline(True)
        await page.close()
        page = await context.new_page()
        await page.goto(base + '?list=complete&question=201601', wait_until='domcontentloaded')
        await page.wait_for_selector('.card')
        await page.locator('button[aria-label="答案"]').click()
        await page.wait_for_selector('.box[data-kind="answer"]')
        await page.evaluate('window.__cdg.idle()')
        original = page.locator('.box[data-kind="answer"] [data-view="orig"]')
        if await original.count():
            await original.click()
        await page.locator('.box[data-kind="answer"] img').evaluate_all("imgs => imgs.forEach(i => i.loading = 'eager')")
        await page.wait_for_function("[...document.querySelectorAll('.box[data-kind=answer] img')].some(i => i.complete && i.naturalWidth > 0)")
        ok('线上下载后断网新开页面可看未访问题及原图', True)
        await context.set_offline(False)
        await page.evaluate("""async () => {
            const scope = (await navigator.serviceWorker.getRegistration()).scope;
            const prefix = 'control-daguan:' + encodeURIComponent(new URL(scope).pathname) + ':shell-';
            for (const key of await caches.keys()) if (key.startsWith(prefix)) await caches.delete(key);
        }""")
        await page.goto(base + '?list=complete&question=201601&recovery=1', wait_until='networkidle')
        expected = len(build_manifest()['files'])
        await page.wait_for_function("""async expected => {
            const scope = (await navigator.serviceWorker.getRegistration()).scope;
            const prefix = 'control-daguan:' + encodeURIComponent(new URL(scope).pathname) + ':shell-';
            for (const key of await caches.keys()) if (key.startsWith(prefix) && (await (await caches.open(key)).keys()).length >= expected) return true;
            return false;
        }""", arg=expected)
        await context.set_offline(True)
        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.goto(base + '?list=complete&question=201601&recovered=1', wait_until='domcontentloaded')
        await page.wait_for_selector('.card')
        await page.locator('button[aria-label="答案"]').click()
        await page.wait_for_selector('.box[data-kind="answer"]')
        await page.evaluate('window.__cdg.idle()')
        await page.screenshot(path=str(directory / 'recovered-offline-mobile.png'), full_page=True)
        ok('线上丢失外壳后联网自动恢复，再断网手机宽度仍正常', await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    finally:
        await context.close()
        await browser.close()


def build_manifest():
    # Parse, do not regenerate, the artifact being checked.
    import json
    import re
    source = (ROOT / 'public/sw.js').read_text()
    return json.loads(re.search(r'const PRECACHE = (\{.*?\});', source, re.S).group(1))


if __name__ == '__main__':
    from playwright.async_api import async_playwright
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', help='read public deployed assets using an isolated browser profile')
    parser.add_argument('--output', type=Path, default=ROOT / 'shots/pwa-live')
    args = parser.parse_args()
    async def main():
        results = []
        def ok(name, condition, detail=''):
            results.append(bool(condition)); print(('PASS' if condition else 'FAIL'), name, detail, flush=True)
        async with async_playwright() as pw:
            if args.live:
                await verify_live(pw, args.live.rstrip('/') + '/', args.output, ok)
            else:
                await verify_resilience(pw, ok)
        print(f'{sum(results)}/{len(results)} passed')
        return 0 if all(results) else 1
    raise SystemExit(asyncio.run(main()))

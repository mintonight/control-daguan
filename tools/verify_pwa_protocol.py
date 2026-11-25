"""Real installed-release -> current upgrade tests, using repository history, isolated profiles only."""
import asyncio
from functools import partial
from http.server import ThreadingHTTPServer
import io
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import threading

from verify_sw_update import UpgradeHandler

ROOT = Path(__file__).resolve().parents[1]
VERSIONS = ['08f2e37', 'ee39c381', '704dce59']
RUNTIME = 'control-daguan:%2Fcontrol-daguan%2F:runtime'


def publish_release(rev, root):
    data = subprocess.check_output(['git', 'archive', rev, 'public'], cwd=ROOT)
    site = root / 'control-daguan'
    if site.exists():
        shutil.rmtree(site)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        archive.extractall(root, filter='data')
    (root / 'public').rename(site)


async def settings(page):
    if not await page.locator('#settings').is_visible():
        await page.locator('#gearBtn').click()
    if await page.locator('#acc-offline-btn').get_attribute('aria-expanded') != 'true':
        await page.locator('#acc-offline-btn').click()


async def complete(page):
    await page.wait_for_function("/已全部缓存|下载未完成|下载失败/.test(document.querySelector('#offlineProgText').textContent)", timeout=120000)
    return await page.locator('#offlineProgText').inner_text()


async def verify_protocol_upgrades(pw, ok):
    for rev in VERSIONS:
        with tempfile.TemporaryDirectory(prefix='cdg-real-upgrade-') as tmp:
            root = Path(tmp)
            publish_release(rev, root)
            server = ThreadingHTTPServer(('127.0.0.1', 0), partial(UpgradeHandler, directory=tmp))
            server.faults = {}
            threading.Thread(target=server.serve_forever, daemon=True).start()
            base = f'http://127.0.0.1:{server.server_port}/control-daguan/'
            browser = await pw.chromium.launch(executable_path='/usr/bin/google-chrome')
            ctx = await browser.new_context()
            if rev == '704dce59':
                await ctx.add_init_script("Object.defineProperty(navigator.storage, 'persist', {value: () => new Promise(() => {})})")
            try:
                page = await ctx.new_page()
                await page.goto(base + '?list=complete&question=202501', wait_until='networkidle')
                await page.wait_for_function('!!navigator.serviceWorker.controller')
                await page.locator('.mk.fav').click()
                await page.locator('button[data-mark="shaky"]').click()
                await page.evaluate('window.__cdg.idle()')
                record = await page.evaluate("""async () => {
                    const r = await __cdg.kv.get('rec');
                    r.notes['202501'] = {text:'upgrade must preserve this note', at:1700000000000};
                    await __cdg.kv.set('rec', r);
                    return {favorites:r.favorites, marks:r.marks, notes:r.notes, srs:r.srs};
                }""")
                await page.evaluate("Promise.all(['data/questions/201601.json','img/a2016-1-1.png'].map(u => fetch(u).then(r => r.blob())))")
                await page.wait_for_function("""async () => {
                    const r = await fetch('img/a2016-1-1.png');
                    return r.ok && !!await caches.match(new URL('data/questions/201601.json', location.href).href);
                }""")
                # Keep an installed window alive so a candidate cannot silently activate in a navigation gap.
                keeper = await ctx.new_page()
                await keeper.goto(base, wait_until='networkidle')
                await keeper.wait_for_function('!!navigator.serviceWorker.controller')
                # Legitimate partial shell loss: the new UI is fetched while the old worker still controls the page.
                await page.evaluate("""async () => {
                    for (const name of await caches.keys()) if (name.includes('shell-'))
                        await (await caches.open(name)).delete(new URL('src/ui/pwa.js', location.href));
                }""")
                shutil.rmtree(root / 'control-daguan')
                shutil.copytree(ROOT / 'public', root / 'control-daguan')
                await page.goto(base + '?list=complete&question=202501', wait_until='domcontentloaded')
                await page.wait_for_selector('.card')
                await settings(page)
                await page.locator('#offlineDlBtn').click()
                text = await complete(page)
                ok(f'{rev} 真实旧安装加载新 UI 后自动协商接管并下载成功', '已全部缓存并逐项核验' in text, text)
                handshake = await page.evaluate("""() => new Promise(resolve => {
                    const channel = new MessageChannel();
                    channel.port1.onmessage = e => {channel.port1.close(); resolve(e.data);};
                    navigator.serviceWorker.controller.postMessage({type:'OFFLINE_HELLO'}, [channel.port2]);
                })""")
                after = await page.evaluate("""async () => {const r=await __cdg.kv.get('rec');return {favorites:r.favorites,marks:r.marks,notes:r.notes,srs:r.srs};}""")
                ok(f'{rev} 控制者支持实际协议，旧学习记录与笔记原样保留', handshake.get('protocol') == 2 and after == record)
                await ctx.set_offline(True)
                await page.goto(base + '?list=complete&question=201601', wait_until='domcontentloaded')
                await page.wait_for_selector('.card')
                await page.locator('button[aria-label="答案"]').click()
                await page.evaluate('window.__cdg.idle()')
                ok(f'{rev} 升级后断网仍能查看原下载题目', bool((await page.locator('.box[data-kind="answer"] .body').inner_text()).strip()))
                await ctx.set_offline(False)
                if rev == '704dce59':
                    ok('持久存储授权一直不返回也不阻塞下载完成', '已全部缓存并逐项核验' in text)
                    server.faults['/control-daguan/img/a2016-1-1.png'] = 'missing'
                    await settings(page)
                    await page.locator('#offlineDlBtn').click()
                    failed = await complete(page)
                    ok('单个题图 HTTP 404 报具体文件，不误报协议超时且不清旧缓存', 'HTTP 404' in failed and 'a2016-1-1.png' in failed and '全部缓存并' not in failed and await page.evaluate("name=>caches.open(name).then(c=>c.match(new URL('img/a2016-1-1.png', location.href))).then(Boolean)", RUNTIME), failed)
                    server.faults.clear()
                    await page.evaluate("""async () => {
                        for (const name of await caches.keys()) if(name.startsWith('control-daguan:%2Fcontrol-daguan%2F:shell-'))
                            await (await caches.open(name)).delete(new URL('icons/favicon-32.png', location.href));
                    }""")
                    server.faults['/control-daguan/icons/favicon-32.png'] = 'missing'
                    await page.locator('#offlineDlBtn').click()
                    failed = await complete(page)
                    ok('单个入口文件损坏明确报告路径，下载按钮恢复且旧题图保留', 'favicon-32.png' in failed and ('HTTP 404' in failed or '完整性校验失败' in failed) and '缓存核验超时' not in failed and await page.locator('#offlineDlBtn').is_enabled(), failed)
            finally:
                await ctx.close()
                await browser.close()
                server.shutdown()
                server.server_close()


async def verify_live_upgrade(pw, base, output, ok):
    """Stage byte-exact old public files in an isolated profile, then switch to the real public deployment."""
    import mimetypes
    from urllib.parse import urlsplit, unquote
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cdg-live-old-profile-') as tmp:
        root = Path(tmp)
        publish_release('704dce59', root)
        browser = await pw.chromium.launch(executable_path='/usr/bin/google-chrome')
        context = await browser.new_context(viewport={'width':1440, 'height':900})
        prefix = urlsplit(base).path
        async def old_assets(route):
            path = unquote(urlsplit(route.request.url).path)
            rel = path[len(prefix):] or 'index.html'
            file = root / 'control-daguan' / rel
            if not file.is_file():
                await route.fulfill(status=404, body='old release file missing')
                return
            mime = mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
            if file.suffix == '.js':
                mime = 'text/javascript'
            await route.fulfill(status=200, body=file.read_bytes(), headers={'Content-Type':mime, 'Cache-Control':'no-store'})
        pattern = base + '**'
        await context.route(pattern, old_assets)
        try:
            page = await context.new_page()
            await page.goto(base + '?list=complete&question=202501', wait_until='networkidle')
            await page.wait_for_function('!!navigator.serviceWorker.controller')
            old_keys = await page.evaluate('caches.keys()')
            ok('线上域名隔离配置中已真实安装旧704版本', any('2d311fe6d96c' in key for key in old_keys), old_keys)
            await page.locator('.mk.fav').click()
            await page.evaluate('window.__cdg.idle()')
            await page.evaluate("""async () => {
                const rec = await __cdg.kv.get('rec');
                rec.notes['202501'] = {text:'isolated live upgrade note', at:1700000000000};
                await __cdg.kv.set('rec', rec);
            }""")
            keeper = await context.new_page()
            await keeper.goto(base, wait_until='networkidle')
            await keeper.wait_for_function('!!navigator.serviceWorker.controller')
            await page.evaluate("""async () => {
                for (const name of await caches.keys()) if(name.includes('shell-'))
                    await (await caches.open(name)).delete(new URL('src/ui/pwa.js', location.href));
            }""")
            # From this point all content and SW installation use the actual public deployment.
            await context.unroute(pattern, old_assets)
            await page.goto(base + '?list=complete&question=202501&live-upgrade=1', wait_until='domcontentloaded')
            await page.wait_for_selector('.card')
            await settings(page)
            await page.locator('#offlineDlBtn').click()
            text = await complete(page)
            ok('旧控制者切换到真实线上新版后可以直接下载', '已全部缓存并逐项核验' in text, text)
            actual = await page.evaluate("""() => new Promise(resolve => {
                const channel = new MessageChannel();
                channel.port1.onmessage = e => {channel.port1.close();resolve(e.data);};
                navigator.serviceWorker.controller.postMessage({type:'OFFLINE_HELLO'}, [channel.port2]);
            })""")
            import json
            import re
            local = (ROOT / 'public/sw.js').read_text()
            version = json.loads(re.search(r'const PRECACHE = (\{.*?\});', local, re.S).group(1))['version']
            rec = await page.evaluate("__cdg.kv.get('rec')")
            ok('线上接管协议和部署版本正确，测试笔记未改动', actual.get('protocol') == 2 and actual.get('version') == version and rec['notes']['202501']['text'] == 'isolated live upgrade note', actual)
            await page.screenshot(path=str(output/'upgraded-download-desktop.png'), full_page=True)
            await context.set_offline(True)
            await page.set_viewport_size({'width':390, 'height':844})
            await page.goto(base + '?list=complete&question=201601&upgraded-offline=1', wait_until='domcontentloaded')
            await page.wait_for_selector('.card')
            await page.locator('button[aria-label="答案"]').click()
            await page.evaluate('window.__cdg.idle()')
            ok('真实线上升级后手机宽度断网仍可查看下载题目', bool((await page.locator('.box[data-kind="answer"] .body').inner_text()).strip()) and await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
            await page.screenshot(path=str(output/'upgraded-offline-mobile.png'), full_page=True)
        finally:
            await context.close()
            await browser.close()


if __name__ == '__main__':
    from playwright.async_api import async_playwright
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--live')
    parser.add_argument('--output', type=Path, default=ROOT / 'shots/pwa-upgrade-live')
    args = parser.parse_args()
    async def main():
        results = []
        def ok(name, cond, detail=''):
            results.append(bool(cond)); print(('PASS' if cond else 'FAIL'), name, detail, flush=True)
        async with async_playwright() as pw:
            if args.live:
                await verify_live_upgrade(pw, args.live.rstrip('/')+'/', args.output, ok)
            else:
                await verify_protocol_upgrades(pw, ok)
        print(f'{sum(results)}/{len(results)} passed')
        return 0 if all(results) else 1
    raise SystemExit(asyncio.run(main()))

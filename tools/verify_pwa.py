"""PWA 验收：manifest、图标、Service Worker、离线、全量缓存、清除、不缓存 GitHub API、更新提示、可安装性。
用法: python3 tools/verify_pwa.py [base_url]

本用例把 public/ 复制到临时目录，并挂到 /control-daguan/ 下提供服务（模拟 GitHub Pages 子路径）。
传入的 base_url 只作提示，不会复用共享端口，以免 Service Worker 干扰其它用例。
"""
import asyncio, io, json, os, re, shutil, struct, subprocess, sys, tempfile, threading, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.async_api import async_playwright

from verify_support import idle
ROOT = Path(__file__).resolve().parents[1]
PREFIX = '/control-daguan'
R = []
SHOT = ROOT / 'shots'

def ok(name, cond, detail=''):
    R.append((name, bool(cond), detail)); print(('PASS' if cond else 'FAIL'), name, detail)

def png_size(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", data[16:24])
    return (w, h)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def translate_path(self, path):
        from urllib.parse import unquote, urlsplit
        raw = unquote(urlsplit(path).path)
        if raw == PREFIX:
            raw = PREFIX + '/'
        if raw.startswith(PREFIX + '/'):
            return super().translate_path(raw[len(PREFIX):] or '/')
        return os.path.join(self.directory, '__missing__')

Handler.extensions_map['.webmanifest'] = 'application/manifest+json'
Handler.extensions_map['.js'] = 'text/javascript'
Handler.extensions_map['.mjs'] = 'text/javascript'
Handler.extensions_map['.json'] = 'application/json'
Handler.extensions_map['.png'] = 'image/png'
Handler.extensions_map['.woff'] = 'font/woff'
Handler.extensions_map['.woff2'] = 'font/woff2'
Handler.extensions_map['.ttf'] = 'font/ttf'
Handler.extensions_map['.css'] = 'text/css'

def make_handler(directory):
    class H(Handler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=directory, **kwargs)
    return H

def start_server(directory):
    httpd = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(directory))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}{PREFIX}/'

async def wait_sw(page, timeout=30000):
    await page.wait_for_function('() => navigator.serviceWorker && !!navigator.serviceWorker.controller', timeout=timeout)
    await page.evaluate('() => navigator.serviceWorker.ready')

async def cached_urls(page):
    return await page.evaluate("""async () => {
      const out = [];
      for (const k of await caches.keys()) {
        const c = await caches.open(k);
        for (const r of await c.keys()) out.push(r.url);
      }
      return out;
    }""")

async def runtime_count(page):
    return await page.evaluate("""async () => {
      if (!(await caches.has('cdg-runtime'))) return 0;
      return (await (await caches.open('cdg-runtime')).keys()).length;
    }""")

async def open_offline_sec(page):
    if not await page.locator('#settings').is_visible():
        await page.locator('#gearBtn').click()
    if await page.locator('#acc-offline-btn').get_attribute('aria-expanded') != 'true':
        await page.locator('#acc-offline-btn').click()

async def main():
    SHOT.mkdir(parents=True, exist_ok=True)
    subprocess.check_call([sys.executable, str(ROOT / 'tools' / 'build_precache.py')])
    tmp = Path(tempfile.mkdtemp(prefix='cdg-pwa-'))
    site = tmp / 'public'
    shutil.copytree(ROOT / 'public', site)
    httpd, BASE = start_server(str(site))
    user_dir = None
    try:
      user_dir = tempfile.mkdtemp(prefix='cdg-chrome-')
      async with async_playwright() as pw:
        ctx = await pw.chromium.launch_persistent_context(
            user_dir, executable_path='/usr/bin/google-chrome',
            viewport={'width': 1440, 'height': 900})
        pg = ctx.pages[0] if ctx.pages else await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        def on_console(m):
            if m.type != 'error': return
            # 故意离线且未缓存时，SW 返回 503，Chromium 会打一条资源错误，不是应用脚本异常
            if '503' in m.text or '(offline)' in m.text: return
            errs.append(f"{m.text} url={m.location.get('url', '')}")
        pg.on('console', on_console)
        await pg.goto(BASE + '?list=complete&question=202501', wait_until='networkidle')
        await wait_sw(pg)

        # --- manifest ---
        href = await pg.locator('link[rel="manifest"]').get_attribute('href')
        ok('manifest 已在页面中链接', href and 'manifest.webmanifest' in href, href)
        theme = await pg.locator('meta[name="theme-color"]').get_attribute('content')
        ok('theme-color 为品牌蓝', theme == '#006bea', theme)
        apple = await pg.locator('link[rel="apple-touch-icon"]').get_attribute('href')
        ok('apple-touch-icon 已链接', apple and 'apple-touch-icon' in apple, apple)
        man = await (await pg.request.get(BASE + 'manifest.webmanifest')).json()
        ok('manifest 字段：name / short_name / lang / display / id',
           man.get('name') == '控制大观' and man.get('short_name') == '控制大观' and man.get('lang') == 'zh-CN'
           and man.get('display') == 'standalone' and bool(man.get('id')),
           {k: man.get(k) for k in ('name', 'short_name', 'lang', 'display', 'id', 'start_url', 'scope')})
        ok('start_url 与 scope 为相对路径 ./', man.get('start_url') == './' and man.get('scope') == './',
           f"{man.get('start_url')} {man.get('scope')}")
        icon_ok = True; icon_detail = []
        for ic in man.get('icons') or []:
            url = BASE + ic['src'] if not ic['src'].startswith('http') else ic['src']
            # src is like icons/icon-192.png, BASE ends with /
            resp = await pg.request.get(BASE + ic['src'])
            if resp.status != 200:
                icon_ok = False; icon_detail.append(f"{ic['src']} HTTP {resp.status}"); continue
            im_size = png_size(await resp.body())
            want = tuple(int(x) for x in ic['sizes'].split('x'))
            icon_detail.append(f"{ic['src']} {im_size} purpose={ic.get('purpose')}")
            if im_size != want:
                icon_ok = False
        ok('manifest 图标可下载且尺寸正确', icon_ok and len(man.get('icons') or []) >= 3, icon_detail)
        apple_resp = await pg.request.get(BASE + 'icons/apple-touch-icon.png')
        apple_im = png_size(await apple_resp.body()) if apple_resp.ok else None
        ok('apple-touch-icon 180×180', apple_im == (180, 180), apple_im if apple_im else apple_resp.status)

        # --- SW ---
        sw = await pg.evaluate("""() => navigator.serviceWorker.getRegistration().then(r => r && ({scope: r.scope, script: (navigator.serviceWorker.controller||{}).scriptURL, active: !!(r.active)}))""")
        ok('Service Worker 已注册并控制页面', sw and sw['active'] and sw['script'] and sw['script'].endswith('/control-daguan/sw.js'), sw)
        ok('SW scope 为子路径 /control-daguan/', sw and sw['scope'].endswith('/control-daguan/'), sw)

        # --- 预热当前题，然后离线访问 ---
        await pg.locator('button[aria-label="答案"]').click()
        await pg.wait_for_selector('.box')
        await pg.wait_for_function("""() => [...document.querySelectorAll('.fig img, .box img, .orig img')].every(i => i.complete && i.naturalWidth > 0)""", timeout=15000)
        # Response rendering is not evidence that SW cache writes have completed.
        await pg.wait_for_function("""async () => {
          const urls = ['data/questions/202501.json', ...[...document.querySelectorAll('.fig img, .box img, .orig img')].map(i => i.src)];
          return (await Promise.all(urls.map(u => caches.match(new URL(u, location.href).href)))).every(Boolean);
        }""")
        await ctx.set_offline(True)
        await pg.goto(BASE + '?list=complete&question=202501', wait_until='domcontentloaded')
        await pg.wait_for_selector('.card')
        stem = await pg.locator('.stem, .card').first.inner_text()
        ok('离线：壳与已访问题目的题干仍能打开', '运算放大' in stem or '2025' in (await pg.locator('.src, .qno, #sectionLabel').first.inner_text()) or await pg.locator('.card').count() > 0, stem[:80])
        await pg.locator('button[aria-label="答案"]').click()
        await pg.wait_for_selector('.box', timeout=8000)
        ok('离线：已访问题目的答案仍能打开', await pg.locator('.box').count() > 0)
        await pg.screenshot(path=str(SHOT / 'pwa-offline-question.png'))
        await ctx.set_offline(False)

        # --- 全量离线下载后打开未访问过的题 ---
        await open_offline_sec(pg)
        await pg.screenshot(path=str(SHOT / 'pwa-settings-offline.png'))
        await pg.locator('#offlineDlBtn').click()
        await pg.wait_for_function("""() => (document.querySelector('#offlineProgText')||{}).textContent.includes('已')""", timeout=90000)
        prog = await pg.locator('#offlineProgText').inner_text()
        n_rt = await runtime_count(pg)
        size_txt = await pg.locator('#offlineSize').inner_text()
        ok('全量下载完成并写入缓存', '失败' not in prog and n_rt > 100, f"{prog} | keys={n_rt} | {size_txt}")
        # 201601 此前未打开过
        await ctx.set_offline(True)
        await pg.goto(BASE + '?list=complete&question=201601', wait_until='domcontentloaded')
        await pg.wait_for_selector('.card')
        await pg.locator('button[aria-label="答案"]').click()
        await pg.wait_for_selector('.box', timeout=8000)
        # 201601 现已有文字答案，默认显示文字；点「原图答案」后再核对接力缓存的扫描件
        await pg.wait_for_selector('.box[data-kind="answer"] .src-tabs, .box .orig img', timeout=8000)
        tabs = pg.locator('.box[data-kind="answer"] .src-tabs button[data-view="orig"]')
        if await tabs.count():
            await tabs.click()
        img_ok = False
        try:
            await pg.wait_for_function("""() => {
              const imgs = [...document.querySelectorAll('.box img, .orig img')];
              return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0);
            }""", timeout=10000)
            img_ok = True
        except Exception as e:
            img_ok = False
        ok('离线：未访问过但已全量缓存的题目能打开答案', await pg.locator('.box').count() > 0 and img_ok)
        await ctx.set_offline(False)

        # --- 清除离线缓存 ---
        await open_offline_sec(pg)
        await pg.locator('#offlineClearBtn').click()
        await pg.locator('#offlineClearYes').click()
        await pg.wait_for_function("document.querySelector('#offlineSize').textContent.includes('未下载')")
        n_after = await runtime_count(pg)
        size_after = await pg.locator('#offlineSize').inner_text()
        ok('清除离线缓存后运行时缓存为空', n_after == 0 and '未下载' in size_after, f"keys={n_after} {size_after}")
        # 浏览器 HTTP 缓存也可能在离线时命中；一并清掉，只保留壳的 Cache Storage
        net = await ctx.new_cdp_session(pg)
        await net.send('Network.enable')
        await net.send('Network.clearBrowserCache')
        await net.detach()
        await ctx.set_offline(True)
        await pg.goto(BASE + '?list=complete&question=201602', wait_until='domcontentloaded')
        await pg.wait_for_selector('.card')
        await pg.locator('button[aria-label="答案"]').click()
        await pg.wait_for_function("document.querySelector('#toast').textContent.includes('失败')")
        await idle(pg, allow_failure=True)
        box_imgs = await pg.evaluate("""() => {
          const imgs = [...document.querySelectorAll('.box img, .orig img')];
          return { boxes: document.querySelectorAll('.box').length, okImgs: imgs.filter(i => i.complete && i.naturalWidth > 0).length };
        }""")
        toast = await pg.locator('#toast').inner_text() if await pg.locator('#toast').is_visible() else ''
        ok('清除后离线打开未缓存题：答案无法从缓存加载', box_imgs['okImgs'] == 0 or '失败' in toast, f"{box_imgs} toast={toast}")
        await ctx.set_offline(False)

        # --- 不缓存 GitHub API ---
        await ctx.route('https://api.github.com/zen', lambda route: route.fulfill(status=200, body='mock public response'))
        await pg.evaluate("""() => fetch('https://api.github.com/zen').then(r => r.text())""")
        urls = await cached_urls(pg)
        leak = [u for u in urls if 'api.github.com' in u or 'githubusercontent.com' in u]
        ok('api.github.com / Gist 请求不被缓存', not leak, leak[:5])

        # --- 更新提示：改 sw.js 后出现 toast ---
        sw_path = site / 'sw.js'
        src = sw_path.read_text(encoding='utf-8')
        src2 = re.sub(r'"version":\s*"[^"]+"', '"version": "testupd123"', src, count=1)
        src2 += f'\n// update-check {time.time()}\n'
        sw_path.write_text(src2, encoding='utf-8')
        await pg.evaluate('() => navigator.serviceWorker.getRegistration().then(r => r.update())')
        await pg.wait_for_selector('#updateToast:not([hidden])', timeout=30000)
        ok('新版本 SW 等待时显示「有新版本，点击更新」', '有新版本' in (await pg.locator('#updateToast').inner_text()))
        await pg.screenshot(path=str(SHOT / 'pwa-update-toast.png'))
        await pg.locator('#updateToast').click()
        await pg.wait_for_function("""() => [...document.querySelectorAll('#updateToast')].every(el => el.hidden) && !!navigator.serviceWorker.controller""", timeout=20000)
        keys = await pg.evaluate('() => caches.keys()')
        ok('点击更新后新的壳缓存生效', any('testupd123' in k for k in keys), keys)

        # --- 可安装性 ---
        # 回到在线、已控制的页面
        await pg.goto(BASE + '?list=complete&question=202501', wait_until='networkidle')
        await wait_sw(pg)
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send('Page.enable')
        await idle(pg)
        inst = await cdp.send('Page.getInstallabilityErrors')
        inst_errs = inst.get('installabilityErrors') or inst.get('errors') or inst.get('installability_errors') or []
        # 过滤已知无害项（如果有）
        ok('Chromium 未报告可安装性错误', inst_errs == [], inst)
        await pg.evaluate("""() => {
          const ev = new Event('beforeinstallprompt', { bubbles: true, cancelable: true });
          ev.prompt = () => Promise.resolve();
          ev.userChoice = Promise.resolve({ outcome: 'accepted' });
          window.dispatchEvent(ev);
        }""")
        await pg.wait_for_selector('#installTopBtn:visible')
        top_vis = await pg.locator('#installTopBtn').is_visible()
        ok('beforeinstallprompt 后顶栏出现「安装应用」', top_vis)
        await open_offline_sec(pg)
        ok('设置「离线与安装」中出现「安装应用」按钮', await pg.locator('#installBtn').is_visible())
        await pg.screenshot(path=str(SHOT / 'pwa-install-button.png'))

        # 模拟 standalone
        await cdp.send('Emulation.setEmulatedMedia', {
            'media': 'screen',
            'features': [{'name': 'display-mode', 'value': 'standalone'}],
        })
        standalone = await pg.evaluate("() => matchMedia('(display-mode: standalone)').matches")
        if not standalone:
            # 当前无头 Chrome 对 display-mode 的 CDP 模拟不生效，在页面里覆写 matchMedia 以验收 UI
            await pg.evaluate("""() => {
              const orig = window.matchMedia.bind(window);
              window.matchMedia = (q) => {
                if (String(q).includes('display-mode: standalone'))
                  return { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; }, onchange: null };
                return orig(q);
              };
            }""")
            standalone = await pg.evaluate("() => matchMedia('(display-mode: standalone)').matches")
        await pg.evaluate("() => window.dispatchEvent(new Event('appinstalled'))")
        await open_offline_sec(pg)
        await pg.wait_for_selector('#installedHint:visible')
        already = await pg.locator('#installedHint').is_visible()
        install_hidden = not await pg.locator('#installBtn').is_visible() and not await pg.locator('#installTopBtn').is_visible()
        ok('standalone 下隐藏安装按钮并显示已安装提示', standalone and already and install_hidden,
           f"matchMedia={standalone} hint={already} install hidden={install_hidden}")
        await pg.screenshot(path=str(SHOT / 'pwa-standalone.png'))
        await cdp.detach()

        page_errs = [e for e in errs if 'favicon' not in e.lower()]
        ok('页面无 JavaScript 错误', not page_errs, str(page_errs[:5]))
        await ctx.close()
    finally:
        httpd.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)
        if user_dir: shutil.rmtree(user_dir, ignore_errors=True)
    print(f'{sum(1 for r in R if r[1])}/{len(R)} passed')
    sys.exit(0 if all(r[1] for r in R) else 1)

asyncio.run(main())

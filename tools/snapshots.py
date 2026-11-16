"""Curated screenshots, called only by verify_all --shots. No accounts or sync requests."""
import datetime as dt
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
from verify_support import idle

ROOT = Path(__file__).resolve().parents[1]
MATRIX = {'desktop': {'width': 1440, 'height': 900}, 'mobile': {'width': 390, 'height': 844}}


async def ready(page):
    await idle(page)
    await page.evaluate("() => { for (const image of document.images) image.loading = 'eager'; }")
    await page.wait_for_function("Array.from(document.images).filter(i => i.getAttribute('src') || i.getClientRects().length).every(i => i.complete && i.naturalWidth > 0)")
    await page.evaluate('() => document.fonts.ready')


async def capture(base, directory):
    directory.mkdir(parents=True, exist_ok=True)
    files = []
    origin = urlsplit(base).netloc
    note = (ROOT / 'tests/fixtures/snapshot-note.md').read_text(encoding='utf-8')
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path='/usr/bin/google-chrome')
        try:
            for scheme in ('light', 'dark'):
                for device, viewport in MATRIX.items():
                    context = await browser.new_context(viewport=viewport, color_scheme=scheme,
                        locale='zh-CN', timezone_id='Asia/Singapore', device_scale_factor=1,
                        reduced_motion='reduce', service_workers='block')
                    writes = []
                    async def safe_request(route):
                        request = route.request
                        if request.method not in ('GET', 'HEAD'):
                            writes.append(f'{request.method} {request.url}')
                            await route.abort()
                        elif urlsplit(request.url).netloc != origin:
                            await route.abort()
                        else:
                            await route.continue_()
                    await context.route('**/*', safe_request)
                    page = await context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    await page.clock.set_fixed_time(dt.datetime(2026, 11, 10, 10, tzinfo=dt.timezone(dt.timedelta(hours=8))))
                    async def open_question(qid):
                        await page.goto(base + f'?list=complete&question={qid}', wait_until='domcontentloaded')
                        await page.add_style_tag(content='*,*::before,*::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }')
                        await idle(page)
                    async def save(state):
                        await ready(page)
                        await page.mouse.move(0, 0)
                        await page.wait_for_function("""() => {
                          const layout = JSON.stringify(Array.from(document.querySelectorAll('*')).map(e => {
                            const r = e.getBoundingClientRect();
                            return [e.scrollTop, e.scrollLeft, r.x, r.y, r.width, r.height];
                          }));
                          const stable = window.snapshotLayout === layout;
                          window.snapshotLayout = layout;
                          return stable;
                        }""")
                        colors = await page.evaluate("({dark: matchMedia('(prefers-color-scheme: dark)').matches, canvas: getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim()})")
                        assert colors == {'dark': scheme == 'dark', 'canvas': '#17191e' if scheme == 'dark' else '#fff'}, colors
                        assert not writes, f'Unexpected network writes: {writes}'
                        assert not errors, f'Unexpected page errors: {errors}'
                        path = directory / f'{scheme}-{device}-{state}.png'
                        await page.screenshot(path=str(path), animations='disabled', caret='hide')
                        files.append({'path': str(path), 'scheme': scheme, 'viewport': viewport,
                            'state': state, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
                        print(f'SNAPSHOT {path}', flush=True)
                    try:
                        await open_question(202306)
                        await page.wait_for_selector('.card .katex')
                        await save('question')
                        await open_question(202402)
                        await page.locator('button[data-act="answer"]').click()
                        await page.locator('button[data-act="exp"]').click()
                        for kind in ('answer', 'exp'):
                            tab = page.locator(f'.box[data-kind="{kind}"] .src-tabs button[data-view="orig"]')
                            if await tab.count():
                                await tab.click()
                        await page.wait_for_selector('.orig img')
                        await page.locator('.box').first.scroll_into_view_if_needed()
                        await save('answer-original')
                        await open_question(202301)
                        await page.locator('button[data-act="note"]').click()
                        await page.locator('textarea.note-input').fill(note)
                        await idle(page)
                        await page.locator('.nb-tabs [data-act="nprev"]').click()
                        await page.wait_for_selector('.nb-view .katex')
                        await page.locator('.notebox').scroll_into_view_if_needed()
                        await save('notes')
                        await open_question(202404)
                        await page.locator('#gearBtn').click()
                        await page.wait_for_selector('#acc-read:not([hidden])')
                        await save('settings')
                        await page.locator('#gearBtn').click()
                        if device == 'mobile':
                            await page.locator('#tocBtn').click()
                        await page.locator('#listBtn').click()
                        await page.wait_for_selector('#listPop:not([hidden])')
                        await save('navigation')
                    finally:
                        await context.close()
        finally:
            await browser.close()
    (directory / 'manifest.json').write_text(json.dumps(files, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return files

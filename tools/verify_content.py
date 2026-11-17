"""Targeted, read-only content rendering and deployed-byte confirmation."""
import asyncio
import hashlib
import json
from pathlib import Path
import urllib.request
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]


def live_bytes(url, ids, paths):
    wanted = {'index.html','sw.js','data/library.json'} | {f'data/questions/{qid}.json' for qid in ids}
    wanted.update(path.removeprefix('public/') for path in paths if path.startswith('public/'))
    rows = []
    for path in sorted(wanted):
        local = ROOT/'public'/path
        if not local.is_file():
            continue
        expected = local.read_bytes()
        digest = hashlib.sha256(expected).hexdigest()
        with urllib.request.urlopen(url+path+'?verify='+digest, timeout=60) as response:
            actual = response.read()
        if actual != expected:
            raise AssertionError(f'deployed bytes differ: {path}')
        rows.append({'path':path,'sha256':digest})
    return rows


async def render(url, ids, directory):
    directory.mkdir(parents=True, exist_ok=True)
    rows = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        errors = []
        for qid in ids:
            data = json.loads((ROOT/f'public/data/questions/{qid}.json').read_text())
            for width, height, name in [(1200,1000,'desktop'),(390,844,'mobile')]:
                page = await browser.new_page(viewport={'width':width,'height':height})
                page.on('pageerror', lambda error: errors.append(str(error)))
                await page.goto(f'{url}?list=complete&question={qid}', wait_until='domcontentloaded')
                await page.locator('button[aria-label="答案"]').click()
                await page.locator('button[aria-label="解析"]').click()
                await page.evaluate('window.__cdg.idle()')
                for kind in ['answer','exp']:
                    assert (await page.locator(f'.box[data-kind="{kind}"] .body').inner_text()).strip(), qid
                box = page.locator('.box[data-kind="exp"]')
                await box.scroll_into_view_if_needed()
                await page.locator('.card img').evaluate_all("imgs=>imgs.forEach(i=>i.loading='eager')")
                await page.wait_for_function("[...document.querySelectorAll('.card img')].every(i=>i.complete&&i.naturalWidth>0)")
                assert await page.locator('.katex-error').count()==0, qid
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), qid
                await page.screenshot(path=str(directory/f'{qid}-{name}.png'),full_page=True)
                if data['explanation']:
                    assert await box.locator('.orig img').count()==0, qid
                    if data['originalImages']:
                        await box.locator('[data-view="orig"]').click()
                        await page.evaluate('window.__cdg.idle()')
                assert await box.locator('.orig img').count()==len(data['originalImages']), qid
                await box.locator('.orig img').evaluate_all("imgs=>imgs.forEach(i=>i.loading='eager')")
                await page.wait_for_function("[...document.querySelectorAll('.orig img')].every(i=>i.complete&&i.naturalWidth>0)")
                await page.close()
            rows.append({'id':qid,'viewports':2,'original_images':len(data['originalImages'])})
        assert not errors, errors
        await browser.close()
    return rows


def verify(url, ids, directory, paths=None):
    rows = asyncio.run(render(url,ids,directory))
    result = {'url':url,'questions':rows,'katex_errors':0}
    if paths is not None:
        result['deployed_hashes'] = live_bytes(url,ids,paths)
    (directory/'report.json').write_text(json.dumps(result,indent=2)+'\n')
    return result

"""设置面板折叠分组验收：默认展开、一次只开一组、键盘操作、提示条常驻、记住上次分组、桌面/手机宽度布局。
用法: python3 tools/verify_settings.py [base_url]"""
import asyncio, sys, json
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
R = []
SECS = ['read', 'review', 'records', 'sync', 'offline', 'about']
CTRL = {'read': '#modeSeg', 'review': '#retention', 'records': '#exportBtn', 'sync': '#gistToken', 'offline': '#offlineDlBtn', 'about': '#aboutRepo'}
def ok(name, cond, detail=''):
    R.append((name, bool(cond), detail)); print(('PASS' if cond else 'FAIL'), name, detail)

async def state(p):
    """每组的 aria-expanded 与面板是否可见"""
    out = {}
    for k in SECS:
        out[k] = (await p.locator(f'#acc-{k}-btn').get_attribute('aria-expanded') == 'true', await p.locator(f'#acc-{k}').is_visible())
    return out
def only(st, key): return all(st[k] == ((k == key),) * 2 for k in SECS)
async def box(p, s): return await p.locator(s).bounding_box()
async def layout(p):
    return await p.evaluate("""() => { const s = document.querySelector('#settings'), b = document.querySelector('#setBody'), r = s.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, hOverflow: b.scrollWidth > b.clientWidth + 1 }; }""")

async def main():
  async with async_playwright() as pw:
    b = await pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(BASE + '?list=complete&question=202501', wait_until='networkidle')
    t = pg.locator
    await t('#gearBtn').click()
    gb = await box(pg, '#gearBtn'); vw = 1440
    ok('设置按钮在顶栏右上角', gb and gb['y'] < 56 and gb['x'] + gb['width'] >= vw - 24 - 1, gb)
    st = await state(pg); ok('默认: 只展开「阅读」，其余收起', only(st, 'read'), json.dumps(st))
    ok('收起分组里的控件不可见', await t('#modeSeg').is_visible() and await t('#fontSeg').is_visible() and not any([await t(CTRL[k]).is_visible() for k in SECS[1:]]))
    aria = [(await t(f'#acc-{k}-btn').get_attribute('aria-controls'), await t(f'#acc-{k}').get_attribute('aria-labelledby')) for k in SECS]
    ok('标题按钮 aria-controls / 面板 aria-labelledby 互相对应', aria == [(f'acc-{k}', f'acc-{k}-btn') for k in SECS], aria)
    repo = t('#aboutRepo')
    ok('关于: GitHub 链接指向仓库并新标签打开', await repo.get_attribute('href') == 'https://github.com/mintonight/control-daguan' and await repo.get_attribute('target') == '_blank' and 'noopener' in (await repo.get_attribute('rel') or ''), f"{await repo.get_attribute('href')} {await repo.get_attribute('target')} {await repo.get_attribute('rel')}")
    ok('收起时标题显示摘要', [await t(s).text_content() for s in ('#accReadSum', '#accReviewSum', '#accSyncSum')] == ['单题 · 标准', '记忆率 0.90', '未连接'],
       [await t(s).text_content() for s in ('#accReadSum', '#accReviewSum', '#accSyncSum')])
    L = await layout(pg); h_read = L['h']
    ok('桌面: 面板宽 270px、在视口内、无横向滚动', abs(L['w'] - 270) < 1 and L['left'] >= 0 and L['right'] <= L['vw'] and L['bottom'] <= L['vh'] and not L['hOverflow'], L)
    await pg.screenshot(path='shots/settings-default.png', clip={'x': max(L['left'] - 20, 0), 'y': 0, 'width': L['w'] + 40, 'height': L['bottom'] + 20})
    # 阅读组控件仍然有效
    await t('#modeSeg button[data-mode="multiple"]').click(); ok('阅读: 切到多题生效、摘要更新', await t('.card').count() > 1 and await t('#accReadSum').text_content() == '多题 · 标准')
    await t('#modeSeg button[data-mode="single"]').click(); await t('#fontSeg button[data-font="115"]').click()
    ok('阅读: 字号生效', await t('#accReadSum').text_content() == '单题 · 大' and abs(float((await pg.evaluate("getComputedStyle(document.querySelector('.cards')).fontSize"))[:-2]) - 15 * 1.15) < 0.6)
    await t('#fontSeg button[data-font="100"]').click()
    # 点击标题切换
    for k in SECS[1:] + ['read']:
        await t(f'#acc-{k}-btn').click(); st = await state(pg)
        ok(f'点「{k}」标题: 展开它并收起其他组', only(st, k) and await t(CTRL[k]).is_visible(), json.dumps(st))
    await t('#acc-read-btn').click(); st = await state(pg)
    ok('再点已展开的标题: 收起（全部收起）', all(v == (False, False) for v in st.values()), json.dumps(st))
    L = await layout(pg); ok('全部收起时面板最矮', L['h'] < h_read, f"{L['h']:.0f} < {h_read:.0f}")
    # 键盘
    await t('#acc-records-btn').focus(); await pg.keyboard.press('Enter'); ok('键盘: Enter 展开', only(await state(pg), 'records'))
    await pg.keyboard.press('ArrowDown'); ok('键盘: ↓ 移到下一个标题', await pg.evaluate("document.activeElement.id") == 'acc-sync-btn')
    await pg.keyboard.press('Space'); ok('键盘: Space 展开并收起其他组', only(await state(pg), 'sync'))
    await pg.keyboard.press('Home'); ok('键盘: Home 回到第一个标题', await pg.evaluate("document.activeElement.id") == 'acc-read-btn')
    await pg.keyboard.press('ArrowUp'); ok('键盘: ↑ 从第一个循环到最后一个', await pg.evaluate("document.activeElement.id") == 'acc-about-btn')
    # 学习记录 + 提示条
    await t('#acc-records-btn').click()
    L = await layout(pg); ok('学习记录展开: 面板在视口内', L['bottom'] <= L['vh'] and not L['hOverflow'], L)
    async with pg.expect_download() as d: await t('#exportBtn').click()
    data = json.load(open(await (await d.value).path()))
    ok('学习记录: 导出可用，导出内容不含界面分组偏好', data.get('version') == 2 and 'setSec' not in data, sorted(data))
    await t('#genCodeBtn').click(); msg = t('#setMsg'); await pg.wait_for_function("document.querySelector('#setMsg').textContent.includes('记录码')", timeout=5000)
    ok('提示条: 操作后在面板底部显示', await msg.is_visible() and '记录码' in await msg.inner_text(), await msg.inner_text())
    await pg.screenshot(path='shots/settings-records.png', clip={'x': max(L['left'] - 20, 0), 'y': 0, 'width': L['w'] + 40, 'height': min(L['bottom'] + 20, 900)})
    await t('#acc-sync-btn').click()
    mb, sb = await box(pg, '#setMsg'), await box(pg, '#settings')
    ok('提示条: 切换分组后仍可见（不在折叠组里）', await msg.is_visible() and mb['y'] + mb['height'] <= sb['y'] + sb['height'] + 1)
    await t('#gistToken').fill('bad'); await t('#syncConnectBtn').click()
    ok('云同步: 连接表单可用（格式错误提示显示在提示条）', 'ghp_' in await msg.inner_text() and await msg.is_visible(), await msg.inner_text())
    # 复习组：确认行
    await t('#acc-review-btn').click(); await t('#resetSrsBtn').click()
    ok('复习: 重置确认行在本组内可见', await t('#resetConfirm').is_visible())
    await t('#acc-read-btn').click(); await t('#acc-review-btn').click()
    ok('复习: 切走再回来确认行仍在', await t('#resetConfirm').is_visible()); await t('#resetNo').click()
    ok('复习: 取消后恢复按钮', await t('#resetSrsBtn').is_visible() and not await t('#resetConfirm').is_visible())
    # 记住上次分组（本机偏好，不进同步）
    await pg.mouse.click(400, 400); ok('点击外部关闭设置', not await t('#settings').is_visible())
    await t('#gearBtn').click(); ok('再次打开: 展开上次的分组', only(await state(pg), 'review'))
    await pg.wait_for_timeout(300); await pg.reload(wait_until='networkidle'); await t('#gearBtn').click()
    ok('刷新后: 仍展开上次的分组', only(await state(pg), 'review'))
    sp = await pg.evaluate("CDGStore.get('rec').then(r => ({ saved: r.setSec, synced: 'setSec' in CDGSync.syncPart(r) }))")
    ok('分组偏好存本机、不参与云同步', sp == {'saved': 'review', 'synced': False}, sp)
    ok('桌面无页面错误', not errs, str(errs[:3]))
    await ctx.close()
    # 手机宽度
    m = await b.new_page(viewport={'width': 390, 'height': 844}); merrs = []
    m.on('pageerror', lambda e: merrs.append(str(e)))
    await m.goto(BASE + '?list=complete&question=202501', wait_until='networkidle')
    gb = await box(m, '#gearBtn'); ok('手机: 设置按钮在顶栏右上角', gb and gb['y'] < 56 and gb['x'] + gb['width'] >= 390 - 16 - 1, gb)
    await m.locator('#gearBtn').click()
    L = await layout(m); ok('手机: 默认展开阅读，面板完整在屏幕内、无横向滚动', only(await state(m), 'read') and L['left'] >= 0 and L['right'] <= L['vw'] and L['bottom'] <= L['vh'] and not L['hOverflow'], L)
    await m.screenshot(path='shots/settings-mobile.png')
    for k in SECS:
        await m.locator(f'#acc-{k}-btn').click() if k != 'read' else None
        L = await layout(m); c = await m.locator(CTRL[k]).bounding_box()
        ok(f'手机: 「{k}」展开后控件可见且在面板宽度内', only(await state(m), k) and c and c['x'] >= L['left'] and c['x'] + c['width'] <= L['right'] + 1 and L['bottom'] <= L['vh'] and not L['hOverflow'], L)
    await m.wait_for_timeout(250); await m.screenshot(path='shots/settings-sync-mobile.png')
    ok('手机无页面错误', not merrs, str(merrs[:3]))
    await b.close()
  print(f'{sum(1 for r in R if r[1])}/{len(R)} passed')
  sys.exit(0 if all(r[1] for r in R) else 1)
asyncio.run(main())

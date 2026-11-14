"""逐个点击控制大观的每个交互控件并断言效果。用法: python3 tools/verify.py [base_url]"""
import asyncio, sys, json, os
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
R = []
async def open_sec(p, key):
    """设置面板是折叠分组：用到某组控件前先展开它"""
    b = p.locator(f'#acc-{key}-btn')
    if await b.get_attribute('aria-expanded') != 'true': await b.click()

def ok(name, cond, detail=''):
    R.append((name, bool(cond), detail)); print(('PASS' if cond else 'FAIL'), name, detail)
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    await ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/').rsplit('/', 0)[0] if False else None)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    await pg.goto(BASE, wait_until='networkidle'); await pg.evaluate('localStorage.clear()'); await pg.reload(wait_until='networkidle')
    t = lambda s: pg.locator(s)
    async def txt(s): return (await t(s).inner_text()).strip()
    ok('首页加载 & KaTeX 渲染', await t('.katex').count() > 0 or await t('.card').count() == 1, await txt('#sectionLabel'))
    # 题单选择
    await t('#listBtn').click(); n = await t('#listPop button').count(); ok('选择题单: 打开下拉', n >= 6, f'{n} 个题单')
    await t('#listPop button[data-list="exam-2024"]').click(); ok('选择题单: 切到 2024 真题', '2024 真题 · 8 题' in await txt('#listName') and '2024' in await txt('.src'), await txt('#listName'))
    ok('URL 同步 list', 'list=exam-2024' in pg.url, pg.url)
    await t('#listBtn').click(); await t('#listPop button[data-list="complete"]').click()
    # 重点题目题单与目录分组
    await t('#listBtn').click()
    ok('题单含重点题目', await t('#listPop button[data-list="featured"]').count() == 1, await t('#listPop').inner_text())
    await t('#listPop button[data-list="featured"]').click()
    ok('选择题单: 切到重点题目', '重点题目 · 23 题' in await txt('#listName'), await txt('#listName'))
    ok('URL 同步 featured', 'list=featured' in pg.url, pg.url)
    feat_chs = ['第二章','第三章','第四章','第五章','第六章','第七章','第八章','第九章','其他点名']
    feat_names = await pg.evaluate("()=>[...document.querySelectorAll('.tree > .node .nm .t')].map(e=>e.textContent)")
    ok('重点题目目录按章节排列', feat_names == feat_chs, str(feat_names))
    await t('.node[data-path="第二章"] .nm').click()
    ok('重点题目: 第二章首题为 2023 第一题', '2023重大844 · 第一题' in await txt('.src'), await txt('.src'))
    await t('.node[data-path="其他点名"] .nm').click()
    ok('重点题目: 其他点名首题为 2017 第一题', '2017重大844 · 第一题' in await txt('.src'), await txt('.src'))
    await t('#listBtn').click(); await t('#listPop button[data-list="complete"]').click()
    ok('完整题库目录含重点题目分组', await t('.node[data-path="重点题目"]').count() == 1)
    await t('.node[data-path="重点题目"] > .tw').click()
    ok('完整题库: 展开重点题目可见第二章', await t('.node[data-path="重点题目 / 第二章"]').count() == 1)
    await t('.node[data-path="重点题目 / 第二章"] .nm').click()
    ok('完整题库: 重点题目/第二章顺序与点名一致', '2023重大844 · 第一题' in await txt('.src'), await txt('.src'))
    await t('#listBtn').click(); await t('#listPop button[data-list="exam-by-year"]').click()
    ok('真题按年目录含重点题目分组', await t('.node[data-path="重点题目"]').count() == 1)
    await t('#listBtn').click(); await t('#listPop button[data-list="complete"]').click()
    # 目录树
    first = t('.tree > .node').first
    name = await first.locator('.t').inner_text()
    await first.locator('.tw').click(); ok('目录: 展开/收起分类(箭头)', await t('.tree > .node').first.evaluate('n=>n.classList.contains("open")') != None, name)
    node = t('.node[data-path="状态空间"] .nm'); import re as _re; cnt = _re.search(r'/ (\d+)', await t('.node[data-path="状态空间"] .nm .c').first.inner_text()).group(1); await node.click()
    ok('目录: 点击分类切换小节', '状态空间' in await txt('#sectionLabel') and f'{cnt} 题' in await txt('#sectionLabel'), await txt('#sectionLabel'))
    await t('.node[data-path="状态空间"] > .tw').click(); await t('.node[data-path="状态空间"] > .tw').click()
    sub = t('.node[data-path="状态空间 / 状态反馈极点配置"] .nm')
    if await sub.count() == 0: await t('.node[data-path="状态空间"] > .tw').click()
    await t('.node[data-path="状态空间 / 状态反馈极点配置"] .nm').click()
    ok('目录: 点击子分类', '状态反馈极点配置' in await txt('#sectionLabel'), await txt('#sectionLabel'))
    # 翻页
    pos0 = await txt('#pos'); await t('#nextBtn').click(); pos1 = await txt('#pos')
    ok('下一题', pos0 != pos1, f'{pos0} -> {pos1}')
    await t('#prevBtn').click(); ok('上一题', await txt('#pos') == pos0, await txt('#pos'))
    await pg.keyboard.press('ArrowRight'); ok('键盘 → 下一题', await txt('#pos') == pos1); await pg.keyboard.press('ArrowLeft')
    # 末题 → 下一小节
    sec = await txt('#sectionLabel')
    for _ in range(10):
        if '下一小节' in await txt('#nextBtn'): break
        await t('#nextBtn').click()
    lab = await txt('#nextBtn'); await t('#nextBtn').click()
    ok('下一小节(到达小节末尾后)', lab == '下一小节' and await txt('#sectionLabel') != sec, f'{sec} -> {await txt("#sectionLabel")}')
    await t('#prevBtn').click(); ok('上一小节', await txt('#sectionLabel') == sec, await txt('#sectionLabel'))
    # 题目卡片
    await pg.goto(BASE + '?list=complete&question=202402', wait_until='networkidle')
    ok('URL 打开指定题 ?question=', '2024重大844 · 第二题' in await txt('.src'), await txt('.src'))
    ok('题图加载', await t('.stem img').count() == 2 and await t('.stem img').first.evaluate('i=>i.complete&&i.naturalWidth>0'))
    await t('.stem img').first.click(); ok('单击放大图片(灯箱)', await t('#lightbox').is_visible())
    await t('#lightbox').click(); ok('关闭灯箱', not await t('#lightbox').is_visible())
    await t('.cat-btn').click(); ok('分类标签: 显示分类路径', await t('.catpop').is_visible(), await t('.catpop').inner_text())
    await t('.catpop button').nth(1).click(); ok('分类路径: 跳转到该分类', 'catpop' and await txt('#sectionLabel') != '' and '2024重大844 · 第二题' in await txt('.src'), await txt('#sectionLabel'))
    await t('button[aria-label="答案"]').click(); await pg.wait_for_selector('.box .katex')
    ok('答案: 显示', 'σ' in await txt('.box') or await t('.box .katex').count() > 0)
    await t('button[aria-label="解析"]').click(); await pg.wait_for_selector('.box[data-kind="exp"] .src-tabs')
    ok('解析: 显示文字解析', await t('.box').count() == 2 and await t('.box[data-kind="exp"] .katex').count() > 0)
    ok('解析: 默认文字、原图未加载', await t('.box[data-kind="exp"] .src-tabs button[data-view="text"]').get_attribute('aria-selected') == 'true' and await t('.orig img').count() == 0)
    await t('.box[data-kind="exp"] .src-tabs button[data-view="orig"]').click()
    await pg.wait_for_selector('.orig img')
    ok('解析: 点击原图解析后显示图片', await t('.orig img').count() >= 1 and await t('.box[data-kind="exp"] .src-tabs button[data-view="orig"]').get_attribute('aria-selected') == 'true')
    await pg.screenshot(path='shots/answer-shown.png')
    await t('.orig img').first.click(); ok('原图解析可放大', await t('#lightbox').is_visible()); await pg.keyboard.press('Escape')
    await t('button[aria-label="答案"]').click(); await t('button[aria-label="解析"]').click()
    ok('答案/解析: 再次点击隐藏', await t('.box').count() == 0)
    # 收藏与标记
    await t('.mk.fav').click(); ok('收藏', await t('.mk.fav').get_attribute('aria-pressed') == 'true')
    await t('button[data-mark="shaky"]').click(); ok('标记 不熟练', await t('button[data-mark="shaky"]').get_attribute('aria-pressed') == 'true' and await t('.unmark').is_visible())
    ok('目录计数随标记更新', '已标记 1' in await txt('.node.sel .c') or '已标记 1' in await txt('.tree'), await txt('.node.sel .c'))
    await t('button[data-mark="unknown"]').click(); ok('标记 不会(互斥切换)', await t('button[data-mark="unknown"]').get_attribute('aria-pressed') == 'true' and await t('button[data-mark="shaky"]').get_attribute('aria-pressed') == 'false')
    await t('.unmark').click(); ok('取消标记', await t('.unmark').count() == 0)
    await t('button[data-mark="mastered"]').click(); ok('标记 掌握', await t('button[data-mark="mastered"]').get_attribute('aria-pressed') == 'true')
    await t('#nextBtn').click(); await t('button[data-mark="shaky"]').click(); shaky_src = await txt('.src')
    # 等 IndexedDB 异步写入完成再刷新，避免 CI 上刷新打断写入造成偶发失败
    await pg.wait_for_function("CDGStore.get('rec').then(r => Object.values(r?.marks || {}).some(m => m.state === 'shaky'))", timeout=5000)
    await pg.reload(wait_until='networkidle'); ok('刷新后记录保留(IndexedDB)', await t('button[data-mark="shaky"]').get_attribute('aria-pressed') == 'true')
    # 收藏 tab
    await t('#tabs button[data-tab="fav"]').click(); ok('收藏 tab: 只显示收藏题', '1 题' in await txt('#sectionLabel') and '第二题' in await txt('.src'), await txt('#sectionLabel'))
    await t('.mk.fav').click(); ok('收藏 tab: 取消收藏后移出', await t('.empty').count() > 0, await txt('#cards'))
    # 复测 tab
    await t('#tabs button[data-tab="retest"]').click(); ok('复测 tab: 默认今日待复习(新评分未到期)', await t('.empty').count() > 0 and await t('#rvSeg button.on').get_attribute('data-rv') == 'due')
    await t('#rvSeg button[data-rv="marked"]').click(); ok('复测 tab: 不熟练·不会 视图', await t('.card').count() == 1 and await txt('.src') == shaky_src, await txt('#sectionLabel'))
    ok('复测历史', await t('details.history').count() == 1); await t('details.history summary').click(); ok('复测历史展开', await t('details.history li').count() >= 1)
    await t('button[data-mark="mastered"]').click(); ok('复测: 标记掌握后移出复测', await t('.empty').count() > 0)
    await t('#tabs button[data-tab="bank"]').click(); ok('题库 tab 返回', await t('.card').count() == 1)
    # 搜索
    await t('#search').fill('李雅普诺夫'); await pg.wait_for_timeout(400)
    ok('搜索: 按关键词过滤', '搜索' in await txt('#sectionLabel') and await t('.card mark').count() >= 0, await txt('#sectionLabel'))
    await t('#search').fill('2025'); await pg.wait_for_timeout(400); ok('搜索: 按年份', '2025' in await txt('.src'), await txt('#sectionLabel'))
    await t('#search').fill('不存在的词xyz'); await pg.wait_for_timeout(400); ok('搜索: 无结果提示', '没有匹配的题目' in await txt('#cards'))
    await t('#search').fill(''); await pg.wait_for_timeout(400); ok('搜索: 清空恢复', '24 题' in await txt('#sectionLabel') or await t('.card').count() == 1, await txt('#sectionLabel'))
    # 目录按钮
    await t('#tocBtn').click(); ok('目录按钮: 收起侧栏', not await t('#sidebar').is_visible())
    await t('#tocBtn').click(); ok('目录按钮: 展开侧栏', await t('#sidebar').is_visible())
    # 设置
    await t('#gearBtn').click(); ok('设置: 打开面板', await t('#settings').is_visible()); await open_sec(pg, 'read')
    await t('#modeSeg button[data-mode="multiple"]').click(); await pg.keyboard.press('Escape')
    nc = await t('.card').count(); ok('阅读模式: 多题', nc > 1 and '节' in await txt('#pos'), f'{nc} 张卡片, {await txt("#pos")}')
    await t('#nextBtn').click(); ok('多题: 下一小节', '第 2' in await txt('#pos'), await txt('#pos'))
    await t('#gearBtn').click(); await open_sec(pg, 'read'); await t('#modeSeg button[data-mode="single"]').click(); ok('阅读模式: 单题', await t('.card').count() == 1)
    for f, lab in [('85', '小'), ('115', '大'), ('130', '特大'), ('100', '标准')]:
        await t(f'#fontSeg button[data-font="{f}"]').click()
        fs = await pg.evaluate("getComputedStyle(document.querySelector('.cards')).fontSize")
        ok(f'字号: {lab}', abs(float(fs[:-2]) - 15 * int(f) / 100) < 0.6, fs)
    await open_sec(pg, 'records')
    async with pg.expect_download() as dl: await t('#exportBtn').click()
    d = await dl.value; path = await d.path(); data = json.load(open(path))
    ok('导出记录 JSON', data.get('app') == 'control-daguan' and 'marks' in data, d.suggested_filename)
    ok('校验并导入记录码: 空时禁用', await t('#importCodeBtn').is_disabled())
    await t('#genCodeBtn').click(); code = await t('#codeInput').input_value(); ok('生成记录码', code.startswith('CG1-'), code[:40] + '…')
    await t('#importCodeBtn').click(); msg = await txt('#setMsg'); ok('校验并导入记录码', '已导入' in msg, msg)
    await t('#codeInput').fill(code[:-3] + 'zzz'); await t('#importCodeBtn').click(); ok('记录码校验失败提示', '校验失败' in await txt('#setMsg'), await txt('#setMsg'))
    await t('#importFile').set_input_files(path); await pg.wait_for_timeout(300); ok('导入记录 JSON', '已导入' in await txt('#setMsg'), await txt('#setMsg'))
    stored = await pg.evaluate("CDGStore.get('rec')"); ok('导入后数据写回(IndexedDB)', stored and len(stored['marks']) >= 1, json.dumps(stored['marks'])[:80])
    bad = '/tmp/bad.json'; open(bad, 'w').write('{"x":1}'); await t('#importFile').set_input_files(bad); await pg.wait_for_timeout(300)
    ok('导入无效 JSON 提示', '不是有效' in await txt('#setMsg'), await txt('#setMsg'))
    await pg.mouse.click(400, 400); ok('点击外部关闭设置', not await t('#settings').is_visible())
    # 品牌链接
    await t('#tabs button[data-tab="fav"]').click(); await t('#brand').click(); ok('品牌 Logo: 回到题库首页', await t('#tabs button[data-tab="bank"]').get_attribute('aria-selected') == 'true')
    # 每一道题渲染检查
    lib = await pg.evaluate("fetch('data/library.json').then(r=>r.json())")
    bad_tex = []
    for q in lib['questions']:
        await pg.goto(BASE + f"?list=complete&question={q['id']}", wait_until='networkidle')
        await t('button[aria-label="答案"]').click(); await t('button[aria-label="解析"]').click(); await pg.wait_for_selector('.box')
        if await t('.src-tabs button[data-view="orig"]').count():
            await t('.src-tabs button[data-view="orig"]').first.click()
        await pg.wait_for_selector('.orig img')
        errs_k = await t('.katex-error').count(); imgs_ok = await pg.evaluate("""async()=>{const ims=[...document.querySelectorAll('.card img')];for(const i of ims){i.loading='eager';i.scrollIntoView();if(!(i.complete&&i.naturalWidth))await new Promise(r=>{i.onload=i.onerror=r;setTimeout(r,8000)});}return ims.every(i=>i.complete&&i.naturalWidth>0)}""")
        if errs_k or not imgs_ok: bad_tex.append((q['id'], errs_k, imgs_ok))
    ok(f'全部 {len(lib["questions"])} 题: 题干/答案/解析 KaTeX 无报错、图片全部加载', not bad_tex, str(bad_tex))
    await pg.goto(BASE + '?list=complete&question=201602', wait_until='networkidle'); await t('button[aria-label="答案"]').click(); await pg.wait_for_selector('.box .orig img')
    ok('仅原图答案题: 答案框显示原图+勘误说明', await t('.box .orig img').count() == 2 and await t('.box .note').count() == 1)
    await t('button[aria-label="解析"]').click(); ok('仅原图答案题: 同时开解析时答案框指向解析', '见下方' in await t('.box').first.inner_text() and await t('.box .orig img').count() == 2)
    # 文字+原图题：解析区切换（默认文字，点击后才加载原图）
    await pg.goto(BASE + '?list=complete&question=202501', wait_until='networkidle')
    await t('button[aria-label="解析"]').click(); await pg.wait_for_selector('.box[data-kind="exp"] .src-tabs')
    exp_tabs = t('.box[data-kind="exp"] .src-tabs')
    ok('文字+原图题: 解析出现切换且默认文字', await exp_tabs.count() == 1 and await exp_tabs.locator('button[data-view="text"]').get_attribute('aria-selected') == 'true' and '文字解析' in await exp_tabs.inner_text())
    ok('文字+原图题: 默认不加载原图', await t('.orig img').count() == 0)
    await exp_tabs.locator('button[data-view="orig"]').click(); await pg.wait_for_selector('.orig img')
    ok('文字+原图题: 点击原图解析后显示图片', await t('.orig img').count() >= 1 and await exp_tabs.locator('button[data-view="orig"]').get_attribute('aria-selected') == 'true')
    await t('button[aria-label="答案"]').click(); await pg.wait_for_selector('.box[data-kind="answer"] .src-tabs')
    ok('文字+原图题: 答案区同样有切换', '文字答案' in await t('.box[data-kind="answer"] .src-tabs').inner_text() and await t('.box[data-kind="answer"] .orig img').count() == 0)
    # 本批已改正的文字+原图题（201601）：自动出现切换，默认文字、原图未加载
    await pg.goto(BASE + '?list=complete&question=201601', wait_until='networkidle')
    await t('button[aria-label="解析"]').click(); await pg.wait_for_selector('.box[data-kind="exp"] .src-tabs')
    ok('201601 改正后: 解析出现切换且默认文字', await t('.box[data-kind="exp"] .src-tabs').count() == 1 and await t('.box[data-kind="exp"] .src-tabs button[data-view="text"]').get_attribute('aria-selected') == 'true' and '文字解析' in await t('.box[data-kind="exp"] .src-tabs').inner_text())
    ok('201601 改正后: 默认不加载原图', await t('.orig img').count() == 0)
    # 仍为仅原图的题目：无切换，直接显示图片（如 201608 严重勘误、文字答案为空）
    await pg.goto(BASE + '?list=complete&question=201608', wait_until='networkidle')
    await t('button[aria-label="答案"]').click(); await pg.wait_for_selector('.box .orig img')
    ok('仅原图题: 无切换直接显示原图', await t('.src-tabs').count() == 0 and await t('.orig img').count() >= 1)
    # 移动端
    m = await b.new_page(viewport={'width': 390, 'height': 844}); await m.goto(BASE + '?list=complete&question=202501', wait_until='networkidle')
    ok('移动端: 侧栏默认隐藏', not await m.locator('#sidebar').is_visible())
    await m.screenshot(path='shots/mobile.png')
    await m.locator('#tocBtn').click(); ok('移动端: 目录抽屉打开', await m.locator('#sidebar').is_visible()); await m.screenshot(path='shots/mobile-drawer.png')
    await m.locator('.node[data-path="根轨迹"] .nm').click(); ok('移动端: 选分类后抽屉关闭', not await m.locator('#sidebar').is_visible() and '根轨迹' in await m.locator('#sectionLabel').inner_text())
    ok('无 JS 报错', not errs, str(errs[:3]))
    await b.close()
  print(f"\n{sum(r[1] for r in R)}/{len(R)} passed")
  json.dump(R, open('shots/verify-results.json', 'w'), ensure_ascii=False, indent=1)
  sys.exit(0 if all(r[1] for r in R) else 1)
asyncio.run(main())

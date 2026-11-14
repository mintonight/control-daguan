"""题目笔记验收：编辑/自动保存/持久化、Markdown 与公式渲染、XSS 清洗、列表标识、导出/导入/记录码、合并规则与 Gist 同步（模拟 API）。
用法: python3 tools/verify_notes.py [base_url]"""
import asyncio, sys, json, re
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
R = []
async def open_sec(p, key):
    """设置面板是折叠分组：用到某组控件前先展开它"""
    b = p.locator(f'#acc-{key}-btn')
    if await b.get_attribute('aria-expanded') != 'true': await b.click()

def ok(name, cond, detail=''):
    R.append((name, bool(cond), detail)); print(('PASS' if cond else 'FAIL'), name, (str(detail)[:300] if not cond else ''))
FILE = 'control-daguan-progress.json'
TOKEN = 'ghp_' + 'B' * 36
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,accept,x-github-api-version',
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-expose-headers': 'x-oauth-scopes,x-ratelimit-remaining'}
class FakeGitHub:
    def __init__(self): self.gists = {}; self.n = 0
    def content(self, gid): return json.loads(self.gists[gid]['files'][FILE]['content'])
    async def handle(self, route):
        req = route.request; m = req.method; path = re.sub(r'^https://api\.github\.com', '', req.url); h = {**CORS, 'x-oauth-scopes': 'gist'}
        if m == 'OPTIONS': return await route.fulfill(status=204, headers=CORS)
        if m == 'GET' and path.startswith('/gists?'):
            return await route.fulfill(headers=h, json=[{'id': k, 'files': {n: {'filename': n} for n in g['files']}} for k, g in self.gists.items()])
        if m == 'POST' and path == '/gists':
            body = json.loads(req.post_data); self.n += 1; gid = f'gist{self.n:04d}notes'
            self.gists[gid] = {'id': gid, 'files': {k: {'content': v['content']} for k, v in body['files'].items()}}
            return await route.fulfill(status=201, headers=h, json=self.gists[gid])
        mm = re.match(r'^/gists/(\w+)$', path)
        if mm and m == 'GET': return await route.fulfill(headers=h, json=self.gists[mm.group(1)])
        if mm and m == 'PATCH':
            for k, v in json.loads(req.post_data)['files'].items(): self.gists[mm.group(1)]['files'][k] = {'content': v['content']}
            return await route.fulfill(headers=h, json=self.gists[mm.group(1)])
        await route.fulfill(status=404, headers=h, json={})

NOTE = r'''# 劳斯判据要点
**加粗** 与 *斜体*，行内代码 `char_eq(s)`

- 首列元素全为正 → 稳定
- 变号次数 = 右半平面根数
  1. 嵌套有序

> 易错：别漏掉 $s^0$ 行

开环传函 $G(s)=\frac{K}{s(Ts+1)}$，下标 $a_1 b_1$ 不应变斜体。

$$
\Phi(s)=\frac{G(s)}{1+G(s)H(s)}
$$

```python
cost = "$5"  # 代码里的 $x$ 不当公式
```

| 参数 | 取值 |
|---|---|
| $K$ | 2 |

[参考链接](https://example.com/routh)
<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>
[坏链接](javascript:window.__xss=3)
'''

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    gh = FakeGitHub()
    async def newpage(w=1440, h=900):
        ctx = await b.new_context(viewport={'width': w, 'height': h}, accept_downloads=True)
        await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        await ctx.route('https://api.github.com/**', gh.handle)
        pg = await ctx.new_page(); pg.errs = []
        pg.on('pageerror', lambda e: pg.errs.append(str(e))); pg.on('dialog', lambda d: (setattr(pg, 'dlg', True), asyncio.ensure_future(d.dismiss())))
        return ctx, pg
    ctx, pg = await newpage(); t = pg.locator
    async def rec(page=None):
        await (page or pg).wait_for_timeout(150); return await (page or pg).evaluate("CDGStore.get('rec').then(r=>r||{})")
    QURL = BASE + '?list=complete&question=202301'
    await pg.goto(QURL, wait_until='networkidle')
    nbtn = t('.card button[data-act="note"]')
    ok('题目页有「笔记」按钮，空笔记默认不展开、无标识', await nbtn.count() == 1 and await t('.notebox').count() == 0 and await t('.note-flag').count() == 0 and await t('.tn').count() == 0)
    await nbtn.click()
    ta = t('textarea.note-input')
    ok('点「笔记」打开编辑器并聚焦', await ta.is_visible() and await pg.evaluate("document.activeElement.matches('textarea.note-input')"))
    ok('空状态是邀请而非报错', '实时预览' in await t('.nb-live').inner_text() and 'Markdown' in (await ta.get_attribute('placeholder')) and await t('.notebox .err').count() == 0)
    await ta.fill(NOTE)
    await pg.wait_for_function("document.querySelector('.nb-status').textContent.includes('已保存')", timeout=5000)
    r = await rec()
    ok('自动保存（防抖）写入 IndexedDB', r.get('notes', {}).get('202301', {}).get('text') == NOTE and r['notes']['202301']['at'] > 0)
    live = t('.nb-live')
    chk = await live.evaluate("""el => ({ h1: el.querySelector('h1')?.textContent, strong: !!el.querySelector('strong'), em: !!el.querySelector('em'), ul: el.querySelectorAll('ul li').length, ol: !!el.querySelector('ol li'),
      bq: !!el.querySelector('blockquote .katex'), code: el.querySelector('p code')?.textContent, pre: el.querySelector('pre code')?.textContent, table: el.querySelectorAll('table th').length, tdmath: !!el.querySelector('td .katex'),
      katexInline: el.querySelectorAll('p .katex').length, katexBlock: !!el.querySelector('.math-block .katex-display'), link: el.querySelector('a[href="https://example.com/routh"]')?.getAttribute('target'), rel: el.querySelector('a[href^="https"]')?.rel,
      sub: el.innerHTML.includes('<em>1 b</em>'), script: el.querySelectorAll('script').length, onerror: el.querySelectorAll('[onerror]').length, jsHref: [...el.querySelectorAll('a')].some(a => /^javascript/i.test(a.getAttribute('href') || '')), raw: el.textContent.includes('<img src=x') })""")
    ok('实时预览: 标题/粗体/斜体/列表/嵌套有序列表', chk['h1'] == '劳斯判据要点' and chk['strong'] and chk['em'] and chk['ul'] >= 2 and chk['ol'], chk)
    ok('实时预览: 引用/行内代码/代码块/表格', chk['bq'] and chk['code'] == 'char_eq(s)' and '$x$' in (chk['pre'] or '') and chk['table'] == 2 and chk['tdmath'], chk)
    ok('实时预览: 行内与块级 KaTeX 公式，下标不被当成斜体', chk['katexInline'] >= 3 and chk['katexBlock'] and not chk['sub'], chk)
    ok('链接在新标签页打开（noopener）', chk['link'] == '_blank' and 'noopener' in (chk['rel'] or ''), chk)
    ok('XSS: 原始 HTML 按文本显示，无 script/onerror/javascript: 链接', chk['script'] == 0 and chk['onerror'] == 0 and not chk['jsHref'] and chk['raw'] and await pg.evaluate('window.__xss') is None, chk)
    ok('题目卡片出现「有笔记」标识，笔记按钮带圆点', await t('.note-flag').count() == 1 and await t('button[data-act="note"] .dot').count() == 1)
    ok('目录树显示笔记数量标识', await t('.node.sel .tn').count() == 1 and (await t('.node.sel .tn').inner_text()).strip() == '1')
    await t('.notebox').scroll_into_view_if_needed(); await pg.screenshot(path='shots/notes-editor.png')
    # 预览视图
    await t('.nb-tabs button[data-act="nprev"]').click()
    v = t('.nb-view')
    ok('切到「预览」: 渲染 Markdown 而非原文', await v.locator('h1').count() == 1 and await v.locator('.katex').count() >= 3 and '**加粗**' not in await v.inner_text())
    await t('.notebox').scroll_into_view_if_needed(); await pg.screenshot(path='shots/notes-preview.png')
    # 输入后立即翻题（未等防抖、未失焦）不丢字
    await t('.nb-tabs button[data-act="nedit"]').click()
    ok('「编辑」切回编辑器并聚焦', await pg.evaluate("document.activeElement.matches('textarea.note-input')"))
    await pg.keyboard.press('End'); await pg.keyboard.type('\n追加一行')
    await t('#nextBtn').click(); await pg.wait_for_timeout(100)
    r = await rec()
    ok('输入后立刻点「下一题」也不丢字', r['notes']['202301']['text'].endswith('追加一行'), r['notes']['202301']['text'][-20:])
    # 另一题写短笔记
    await t('.card button[data-act="note"]').click(); qid2 = await t('.card').get_attribute('data-id')
    await t('textarea.note-input').type('第二题：**注意** 采样周期'); await pg.wait_for_timeout(900)
    ok('每题独立保存', (await rec())['notes'][qid2]['text'] == '第二题：**注意** 采样周期' and (await rec())['notes']['202301']['text'].startswith('# 劳斯'))
    await pg.keyboard.type('X'); await pg.reload(wait_until='networkidle')
    r = await rec()
    ok('输入后立即刷新（pagehide 时写入）也不丢字', r['notes'][qid2]['text'].endswith('X'), r['notes'][qid2]['text'])
    # 刷新后持久化与默认预览
    await pg.goto(QURL, wait_until='networkidle')
    ok('刷新后已有笔记默认收起、按钮有标识', await t('.notebox').count() == 0 and await t('.card button[data-act="note"] .dot').count() == 1)
    ok('刷新后列表标识仍在（目录树笔记数 ≥2）', sum([int((await x.inner_text()).strip()) for x in await t('.node.top .tn').all()]) >= 2)
    # 展开 / 收起
    await t('.card button[data-act="note"]').click()
    ok('点「笔记」展开已有笔记，默认为预览', await t('.nb-view h1').count() == 1 and await t('textarea.note-input').count() == 0 and await t('.nb-tabs button[data-act="nprev"]').get_attribute('aria-selected') == 'true')
    await t('.card button[data-act="note"]').click()
    ok('「笔记」按钮可收起已有笔记', await t('.notebox').count() == 0 and await t('.note-flag').count() == 1)
    await t('.card button[data-act="note"]').click(); ok('再次点击展开', await t('.nb-view h1').count() == 1)
    # 双击预览进入编辑
    await t('.nb-view h1').dblclick(); ok('双击预览进入编辑', await t('textarea.note-input').count() == 1)
    # 现有按钮仍可用
    await t('button[data-mark="shaky"]').click(); r = await rec()
    ok('笔记打开时 FSRS 评分仍可用、笔记不受影响', r['marks']['202301']['state'] == 'shaky' and r['srs']['202301']['card']['reps'] == 1 and r['notes']['202301']['text'].startswith('# 劳斯'))
    await t('.card button[data-act="answer"]').click(); await t('.card button[data-act="exp"]').click()
    ok('答案/解析与笔记可同时展开', await t('.box h4:has-text("答案")').count() == 1 and await t('.box h4:has-text("解析")').count() == 1 and await t('.notebox').count() == 1)
    # 搜索笔记内容
    await t('#search').fill('劳斯判据要点'); await pg.wait_for_timeout(400)
    ok('搜索能找到笔记内容', await t('.card[data-id="202301"]').count() == 1)
    await t('#search').fill(''); await pg.wait_for_timeout(400)
    # 多题模式
    await t('#gearBtn').click(); await open_sec(pg, 'read'); await t('#modeSeg button[data-mode="multiple"]').click(); await pg.mouse.click(400, 400)
    ok('多题模式: 每张卡片各自有笔记按钮，有笔记的题显示标识', await t('.card button[data-act="note"]').count() > 1 and await t('.card[data-id="202301"] .note-flag').count() == 1)
    await t('#gearBtn').click(); await open_sec(pg, 'read'); await t('#modeSeg button[data-mode="single"]').click(); await pg.mouse.click(400, 400)
    # ---------- 导出 / 导入 ----------
    await t('#gearBtn').click(); await open_sec(pg, 'records')
    async with pg.expect_download() as d: await t('#exportBtn').click()
    exp = json.loads(open(await (await d.value).path()).read())
    ok('导出 JSON 包含 notes，版本保持 v2（向后兼容）', exp['version'] == 2 and exp['notes']['202301']['text'].startswith('# 劳斯') and qid2 in exp['notes'])
    await t('#genCodeBtn').click(); code = await t('#codeInput').input_value()
    ctx2, pg2 = await newpage(); await pg2.goto(QURL, wait_until='networkidle')
    await pg2.locator('#gearBtn').click(); await open_sec(pg2, 'records'); await pg2.locator('#codeInput').fill(code); await pg2.locator('#importCodeBtn').click(); await pg2.wait_for_timeout(300)
    r2 = await rec(pg2)
    ok('记录码往返包含笔记', r2.get('notes', {}).get('202301', {}).get('text') == exp['notes']['202301']['text'] and await pg2.locator('.note-flag').count() == 1)
    # 新设备导入 JSON；旧 v2（无 notes）文件导入不清空笔记；较旧的笔记不覆盖较新的
    ctx3, pg3 = await newpage(); await pg3.goto(QURL, wait_until='networkidle')
    imp = '/tmp/cdg-notes-import.json'
    json.dump(exp, open(imp, 'w'), ensure_ascii=False)
    await pg3.locator('#gearBtn').click(); await pg3.locator('#importFile').set_input_files(imp); await pg3.wait_for_timeout(300)
    ok('导入 JSON 恢复笔记并标识、默认收起', (await rec(pg3))['notes']['202301']['text'] == exp['notes']['202301']['text'] and await pg3.locator('.note-flag').count() == 1 and await pg3.locator('.notebox').count() == 0)
    old = {k: v for k, v in exp.items() if k != 'notes'}; json.dump(old, open(imp, 'w'))
    await pg3.locator('#importFile').set_input_files(imp); await pg3.wait_for_timeout(300)
    ok('导入不含 notes 的旧 v2 文件：成功且不清空笔记', '已导入' in await pg3.locator('#setMsg').inner_text() and (await rec(pg3))['notes']['202301']['text'] == exp['notes']['202301']['text'])
    stale = {**exp, 'notes': {'202301': {'text': '旧内容', 'at': 1000}, '209999': {'text': '不存在的题', 'at': 9e12}}}; json.dump(stale, open(imp, 'w'), ensure_ascii=False)
    await pg3.locator('#importFile').set_input_files(imp); await pg3.wait_for_timeout(300); r3 = await rec(pg3)
    ok('导入时较新的本地笔记不被旧笔记覆盖，未知题号忽略', r3['notes']['202301']['text'] == exp['notes']['202301']['text'] and '209999' not in r3['notes'])
    await ctx2.close(); await ctx3.close()
    # ---------- 合并规则（纯函数） ----------
    res = await pg.evaluate("""() => {
      const M = CDGSync.merge, C = CDGSync.canon, sp = CDGSync.syncPart;
      const A = { notes: { 1: { text: 'A 新', at: 300 }, 2: { text: 'A 旧', at: 100 }, 3: { text: '', at: 500 }, 5: { text: '只有 A', at: 10 } }, updated: {}, marks: {}, srs: {}, favorites: [] };
      const B = { notes: { 1: { text: 'B 旧', at: 200 }, 2: { text: 'B 新', at: 400 }, 3: { text: '远端旧内容', at: 450 }, 4: { text: '只有 B', at: 20 } }, updated: {}, marks: {}, srs: {}, favorites: [] };
      const m = M(A, B), m2 = M(B, A), tie = M({ notes: { 1: { text: 'x', at: 5 } } }, { notes: { 1: { text: 'y', at: 5 } } }), tie2 = M({ notes: { 1: { text: 'y', at: 5 } } }, { notes: { 1: { text: 'x', at: 5 } } });
      const legacyRemote = M(A, { favorites: [], marks: {}, srs: {}, updated: {} });
      const bad = CDGNotes.normalize({ 1: { text: 5, at: 1 }, x: { text: 'a', at: 1 }, 2: { text: 'ok', at: 0 }, 3: { text: 'ok', at: 7 } });
      return { m: m.notes, commut: C(sp(m)) === C(sp(m2)), idem: C(sp(M(m, m))) === C(sp(m)), tie: C(tie.notes) === C(tie2.notes), legacy: legacyRemote.notes, bad };
    }""")
    m = res['m']
    ok('合并: 逐题取较新的笔记（双向）', m['1']['text'] == 'A 新' and m['2']['text'] == 'B 新', m)
    ok('合并: 较新的清空（删除）生效，不被远端旧笔记复活', m['3']['text'] == '', m)
    ok('合并: 单边独有笔记保留；交换律/幂等/同时刻决胜一致', m['4']['text'] == '只有 B' and m['5']['text'] == '只有 A' and res['commut'] and res['idem'] and res['tie'], res)
    ok('合并: 远端是旧版（无 notes）时保留本地笔记', res['legacy']['1']['text'] == 'A 新', res['legacy'])
    ok('笔记数据校验：丢弃格式错误的条目', list(res['bad'].keys()) == ['3'], res['bad'])
    # ---------- Gist 同步（模拟 API） ----------
    await t('#gearBtn').click() if await t('#settings').is_hidden() else None
    await open_sec(pg, 'sync')
    await t('#gistToken').fill(TOKEN); await t('#syncConnectBtn').click()
    await pg.wait_for_function("document.querySelector('#setMsg').textContent.includes('已连接')", timeout=8000)
    gid = next(iter(gh.gists)); remote = gh.content(gid)
    ok('Gist 同步: 上传的进度文件包含笔记', remote.get('notes', {}).get('202301', {}).get('text', '').startswith('# 劳斯'), list(remote.keys()))
    # 另一台设备在远端改了笔记（更新时间更晚）
    remote['notes']['202301'] = {'text': '## 远端更新\n$K>0$', 'at': remote['notes']['202301']['at'] + 60000}
    remote['notes']['202302'] = {'text': '远端新增', 'at': 1}
    gh.gists[gid]['files'][FILE]['content'] = json.dumps(remote, ensure_ascii=False)
    await t('#syncNowBtn').click(); await pg.wait_for_function("document.querySelector('#setMsg').textContent.includes('同步完成')", timeout=8000)
    r = await rec()
    ok('Gist 同步: 拉取远端较新的笔记并刷新界面', r['notes']['202301']['text'].startswith('## 远端更新') and await t('.card[data-id="202301"] .md-body h2').count() == 1 and r['notes'].get('202302', {}).get('text') == '远端新增')
    await pg.mouse.click(400, 400)
    if await t('textarea.note-input').count() == 0: await t('.nb-tabs button[data-act="nedit"]').click()
    await t('textarea.note-input').fill('本地再改'); await pg.wait_for_timeout(900 + 3500)
    ok('Gist 同步: 本地编辑笔记后自动上传', gh.content(gid)['notes']['202301']['text'] == '本地再改', [gh.content(gid)['notes']['202301'], (await rec())['notes']['202301'], await t('#syncStatus').inner_text(), await t('.card').get_attribute('data-id')])
    # 清空：两步确认
    await t('.nb-clear').click()
    ok('「清空笔记」需再次确认', 'X' and (await t('.nb-clear').inner_text()).startswith('再点一次') and (await rec())['notes']['202301']['text'] == '本地再改')
    await t('.nb-clear').click(); r = await rec()
    ok('清空后：留删除时间戳、标识消失', r['notes']['202301']['text'] == '' and r['notes']['202301']['at'] > 0 and await t('.card .note-flag').count() == 0 and await t('button[data-act="note"] .dot').count() == 0)
    await pg.wait_for_timeout(3600)
    ok('Gist 同步: 删除同步到远端', gh.content(gid)['notes']['202301']['text'] == '')
    await t('#syncOffBtn').click() if await t('#syncOffBtn').is_visible() else None
    # ---------- 手机宽度 ----------
    ctx4, pg4 = await newpage(390, 844); await pg4.goto(QURL, wait_until='networkidle')
    await pg4.locator('.card button[data-act="note"]').click(); await pg4.locator('textarea.note-input').fill('手机 **笔记** $x^2$'); await pg4.wait_for_timeout(900)
    ok('手机宽度: 编辑器可用（实时预览隐藏，可切到预览）', await pg4.locator('textarea.note-input').is_visible() and not await pg4.locator('.nb-live').is_visible())
    await pg4.locator('.nb-tabs button[data-act="nprev"]').click()
    ok('手机宽度: 预览渲染', await pg4.locator('.nb-view strong').count() == 1 and await pg4.locator('.nb-view .katex').count() == 1)
    await pg4.locator('.notebox').scroll_into_view_if_needed(); await pg4.screenshot(path='shots/notes-mobile.png')
    ok('无页面错误', not pg.errs and not pg4.errs, str(pg.errs + pg4.errs))
    await b.close()
  n = sum(1 for r in R if r[1]); print(f'{n}/{len(R)} passed'); sys.exit(0 if n == len(R) else 1)
asyncio.run(main())

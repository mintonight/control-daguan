"""IndexedDB 迁移 + 合并逻辑 + Gist 同步验收（Gist API 全部用 Playwright 路由模拟，不访问真实 GitHub）。
用法: python3 tools/verify_sync.py [base_url]"""
import asyncio, sys, json, re, time
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
R = []
async def open_sec(p, key):
    """设置面板是折叠分组：用到某组控件前先展开它"""
    b = p.locator(f'#acc-{key}-btn')
    if await b.get_attribute('aria-expanded') != 'true': await b.click()

def ok(name, cond, detail=''):
    R.append((name, bool(cond), detail)); print(('PASS' if cond else 'FAIL'), name, detail)
FILE = 'control-daguan-progress.json'
TOKEN = 'ghp_' + 'A' * 36
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type,accept,x-github-api-version',
        'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-expose-headers': 'x-oauth-scopes,x-ratelimit-remaining'}

class FakeGitHub:
    """内存中的 Gist API。mode 可设为 'ok' / '401' / '500' / 'abort' / 'ratelimit'。"""
    def __init__(self): self.gists = {}; self.log = []; self.mode = 'ok'; self.n = 0; self.scopes = 'gist'
    def content(self, gid): return json.loads(self.gists[gid]['files'][FILE]['content'])
    async def handle(self, route):
        req = route.request; m = req.method; path = re.sub(r'^https://api\.github\.com', '', req.url)
        if m == 'OPTIONS': return await route.fulfill(status=204, headers=CORS)
        self.log.append((m, path, req.headers.get('authorization'), req.post_data))
        if self.mode == 'abort': return await route.abort('internetdisconnected')
        if self.mode == '401': return await route.fulfill(status=401, headers=CORS, json={'message': 'Bad credentials'})
        if self.mode == 'ratelimit': return await route.fulfill(status=403, headers={**CORS, 'x-ratelimit-remaining': '0'}, json={'message': 'rate limit'})
        if self.mode == '500': return await route.fulfill(status=500, headers=CORS, json={'message': 'boom'})
        h = {**CORS, 'x-oauth-scopes': self.scopes}
        if req.headers.get('authorization') != f'Bearer {TOKEN}': return await route.fulfill(status=401, headers=CORS, json={})
        if m == 'GET' and path.startswith('/gists?'):
            return await route.fulfill(headers=h, json=[{'id': k, 'files': {n: {'filename': n} for n in g['files']}} for k, g in self.gists.items()])
        if m == 'POST' and path == '/gists':
            body = json.loads(req.post_data); self.n += 1; gid = f'gist{self.n:04d}abcdef'
            self.gists[gid] = {'id': gid, 'public': body['public'], 'description': body['description'], 'files': {k: {'content': v['content']} for k, v in body['files'].items()}}
            return await route.fulfill(status=201, headers=h, json=self.gists[gid])
        mm = re.match(r'^/gists/(\w+)$', path)
        if mm and mm.group(1) not in self.gists: return await route.fulfill(status=404, headers=h, json={'message': 'Not Found'})
        if mm and m == 'GET': return await route.fulfill(headers=h, json=self.gists[mm.group(1)])
        if mm and m == 'PATCH':
            body = json.loads(req.post_data)
            for k, v in body['files'].items(): self.gists[mm.group(1)]['files'][k] = {'content': v['content']}
            return await route.fulfill(headers=h, json=self.gists[mm.group(1)])
        await route.fulfill(status=404, headers=h, json={})

async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    gh = FakeGitHub()
    async def newpage():
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.route('https://api.github.com/**', gh.handle)
        pg = await ctx.new_page(); pg.errs = []
        pg.on('pageerror', lambda e: pg.errs.append(str(e)))
        return ctx, pg
    ctx, pg = await newpage(); t = lambda s: pg.locator(s)
    async def txt(s, page=None): return (await (page or pg).locator(s).first.inner_text()).strip()
    async def rec(page=None):
        await (page or pg).wait_for_timeout(150); return await (page or pg).evaluate("CDGStore.get('rec').then(r=>r||null)")
    # ---------- 1. 迁移 ----------
    await pg.goto(BASE + '?list=complete&question=202301', wait_until='networkidle')
    legacy = {'favorites': [202301], 'marks': {'202301': {'state': 'unknown', 'at': 1700000000000}, '202302': {'state': 'shaky', 'at': 1700000000000}},
              'history': [{'id': 202301, 'state': 'unknown', 'at': 1700000000000}], 'mode': 'single', 'fontScale': 115, 'retention': 0.85,
              'srs': {'202301': {'card': {'due': '2023-11-15T00:00:00.000Z', 'stability': 0.2, 'difficulty': 6.4, 'scheduled_days': 1, 'reps': 1, 'lapses': 0, 'learning_steps': 0, 'state': 2, 'last_review': '2023-11-14T22:13:20.000Z'},
                                 'logs': [{'id': '202301-1700000000000', 'rating': 1, 'mark': 'unknown', 'state': 0, 'due': '2023-11-14T22:13:20.000Z', 'stability': 0, 'difficulty': 0, 'scheduled_days': 0, 'review': '2023-11-14T22:13:20.000Z'}]}}}
    await pg.evaluate("l => { localStorage.setItem('control-daguan:v1', JSON.stringify(l)); }", legacy)
    await pg.reload(wait_until='networkidle'); await pg.wait_for_timeout(300)
    r = await rec()
    ok('迁移: localStorage 记录写入 IndexedDB', r and r['marks']['202301']['state'] == 'unknown' and r['favorites'] == [202301] and r['srs']['202301']['card']['reps'] == 1 and r['fontScale'] == 115 and r['retention'] == 0.85, json.dumps(r, ensure_ascii=False)[:200] if r else None)
    ok('迁移: 删除 localStorage 旧键', await pg.evaluate("localStorage.getItem('control-daguan:v1')") is None)
    ok('迁移: 界面显示迁移后的标记与收藏', await t('button[data-mark="unknown"]').get_attribute('aria-pressed') == 'true' and await t('.mk.fav').get_attribute('aria-pressed') == 'true')
    await pg.reload(wait_until='networkidle'); ok('迁移后刷新: 从 IndexedDB 读取', await t('button[data-mark="unknown"]').get_attribute('aria-pressed') == 'true')
    # 两边都有：逐题取较新
    await pg.evaluate("l => localStorage.setItem('control-daguan:v1', JSON.stringify(l))", {'favorites': [], 'marks': {'202301': {'state': 'mastered', 'at': 1600000000000}, '202303': {'state': 'shaky', 'at': 1600000000000}}, 'history': []})
    await pg.reload(wait_until='networkidle'); r = await rec()
    ok('迁移(两边都有数据): 较新的 IndexedDB 标记保留，旧键独有的题并入', r['marks']['202301']['state'] == 'unknown' and r['marks']['202303']['state'] == 'shaky' and await pg.evaluate("localStorage.getItem('control-daguan:v1')") is None, json.dumps(r['marks']))
    # 标记后写入 IndexedDB，localStorage 不再使用
    await t('button[data-mark="mastered"]').click(); r = await rec()
    ok('新改动只写 IndexedDB', r['marks']['202301']['state'] == 'mastered' and r['updated']['202301'] > 1700000000000 and await pg.evaluate("localStorage.length") == 0)
    # ---------- 2. 合并逻辑（纯函数） ----------
    res = await pg.evaluate("""() => {
      const M = CDGSync.merge, card = (t, reps) => ({ due: new Date(t + 864e5).toISOString(), last_review: new Date(t).toISOString(), reps, stability: 1, difficulty: 5, state: 2, scheduled_days: 1, lapses: 0, learning_steps: 0 });
      const log = (q, t) => ({ id: `${q}-${t}`, rating: 3, review: new Date(t).toISOString() });
      const A = { favorites: [1, 2], marks: { 1: { state: 'shaky', at: 100 }, 3: { state: 'unknown', at: 500 } }, srs: { 1: { card: card(100, 1), logs: [log(1, 100)] }, 4: { card: card(50, 1), logs: [log(4, 50)] } },
                  updated: { 1: 100, 2: 900, 3: 500, 4: 950 }, history: [{ id: 1, state: 'shaky', at: 100 }], retention: 0.9, retentionAt: 10, mode: 'multiple' };
      const B = { favorites: [1], marks: { 1: { state: 'mastered', at: 300 }, 2: { state: 'unknown', at: 200 } }, srs: { 1: { card: card(300, 2), logs: [log(1, 100), log(1, 300)] }, 4: { card: card(60, 2), logs: [log(4, 50), log(4, 60)] } },
                  updated: { 1: 300, 2: 200, 4: 60 }, history: [{ id: 1, state: 'shaky', at: 100 }, { id: 1, state: 'mastered', at: 300 }], retention: 0.85, retentionAt: 20, mode: 'single' };
      const m = M(A, B), m2 = M(B, A), mm = M(m, m);
      const C = CDGSync.canon, sp = CDGSync.syncPart;
      return { m, commut: C(sp(m)) === C(sp(m2)), idem: C(sp(mm)) === C(sp(m)), empty: C(sp(M({}, A))) === C(sp(M(A, {}))) };
    }""")
    m = res['m']
    ok('合并: 每题取最后更新的一方（题1 远端较新 → 掌握 + 远端卡片）', m['marks']['1']['state'] == 'mastered' and m['srs']['1']['card']['reps'] == 2, json.dumps(m['marks']))
    ok('合并: 复习日志按 id 取并集去重', [l['id'] for l in m['srs']['1']['logs']] == ['1-100', '1-300'])
    ok('合并: 本地较新的删除生效（题2 本地取消标记/收藏较新 → 不带远端标记）', '2' not in m['marks'] and 2 in m['favorites'])
    ok('合并: 本地独有的题保留', m['marks']['3']['state'] == 'unknown')
    ok('合并: 题4 本地较新但远端日志也并入', m['srs']['4']['card']['reps'] == 1 and len(m['srs']['4']['logs']) == 2)
    ok('合并: 记录历史并集、记忆率取较新设置、界面偏好保持本地', len(m['history']) == 2 and m['retention'] == 0.85 and m['mode'] == 'multiple')
    ok('合并: 交换律 / 幂等 / 与空记录合并', res['commut'] and res['idem'] and res['empty'], json.dumps({k: res[k] for k in ('commut', 'idem', 'empty')}))
    tomb = await pg.evaluate("""() => { const c = { due: '2026-01-02T00:00:00Z', last_review: '2026-01-01T00:00:00Z', reps: 3 };
      const L = { srs: {}, updated: { 7: Date.parse('2026-02-01') } }, Rm = { srs: { 7: { card: c, logs: [{ id: 'x', review: '2026-01-01T00:00:00Z' }] } }, updated: { 7: Date.parse('2026-01-01') } };
      return CDGSync.merge(L, Rm).srs; }""")
    ok('合并: 本地较新的「重置复习进度」不被远端旧卡片恢复', tomb == {})
    # ---------- 3. Gist 同步 ----------
    await t('#gearBtn').click(); await open_sec(pg, 'sync')
    ok('设置: 显示令牌说明与创建链接', await t('#syncOff a[href*="settings/tokens/new?scopes=gist"]').count() == 1 and await t('#syncOff a[href*="personal-access-tokens/new"]').count() == 1)
    await t('#gistToken').fill('not-a-token'); await t('#syncConnectBtn').click()
    ok('连接: 拒绝格式错误的令牌（不发请求）', 'ghp_' in await txt('#setMsg') and not gh.log)
    await t('#gistToken').fill(TOKEN); await t('#syncConnectBtn').click(); await pg.wait_for_function("document.querySelector('#setMsg').textContent.includes('已连接')", timeout=8000)
    gid = next(iter(gh.gists)); g = gh.gists[gid]
    ok('连接: 未找到进度 Gist → 新建私密 Gist', len(gh.gists) == 1 and g['public'] is False and FILE in g['files'], f'{gid} public={g["public"]}')
    ok('请求带 Bearer 令牌', all(l[2] == f'Bearer {TOKEN}' for l in gh.log))
    ok('新建的 Gist 内容 = 本地进度', gh.content(gid)['marks']['202301']['state'] == 'mastered')
    cfg = await pg.evaluate("CDGStore.get('gist')")
    ok('令牌与 gist id 保存在本机 IndexedDB', cfg['token'] == TOKEN and cfg['gistId'] == gid and cfg['lastSync'] > 0)
    ok('令牌不写入 localStorage / 记录 / 导出', await pg.evaluate("JSON.stringify(localStorage).includes('ghp_')") is False and TOKEN not in json.dumps(await rec()))
    ok('显示同步状态与最近同步时间', '已同步' in await txt('#syncStatus') and '最近成功同步' in await txt('#syncMeta'), await txt('#syncStatus'))
    # 改动 → 防抖上传
    n0 = len(gh.log); await pg.mouse.click(400, 400)
    await t('#nextBtn').click(); q2 = int(re.search(r'question=(\d+)', pg.url).group(1))
    await t('button[data-mark="shaky"]').click(); await t('.mk.fav').click()
    await pg.wait_for_timeout(1000); early = [l for l in gh.log[n0:] if l[0] == 'PATCH']
    await pg.wait_for_timeout(3500); patches = [l for l in gh.log[n0:] if l[0] == 'PATCH']
    ok('改动后防抖同步（多次改动合并为一次上传）', not early and len(patches) == 1 and gh.content(gid)['marks'][str(q2)]['state'] == 'shaky' and q2 in gh.content(gid)['favorites'], f'{len(early)} early, {len(patches)} patches')
    # 远端改动 → 立即同步拉取
    c = gh.content(gid); now = int(time.time() * 1000); c['marks']['202305'] = {'state': 'unknown', 'at': now}; c['updated']['202305'] = now
    gh.gists[gid]['files'][FILE]['content'] = json.dumps(c)
    await t('#gearBtn').click(); await open_sec(pg, 'sync'); await t('#syncNowBtn').click(); await pg.wait_for_function("document.querySelector('#setMsg').textContent.includes('同步完成')")
    r = await rec(); ok('立即同步: 拉取远端改动', r['marks'].get('202305', {}).get('state') == 'unknown', await txt('#setMsg'))
    # 加载时同步
    c = gh.content(gid); c['favorites'].append(202306); c['updated']['202306'] = int(time.time() * 1000); gh.gists[gid]['files'][FILE]['content'] = json.dumps(c)
    await pg.goto(BASE + '?list=complete&question=202306', wait_until='networkidle'); await pg.wait_for_timeout(600)
    ok('打开页面时自动同步', await t('.mk.fav').get_attribute('aria-pressed') == 'true')
    # 第二台设备：找到已有 Gist
    ctx2, pg2 = await newpage(); posts = sum(1 for l in gh.log if l[0] == 'POST')
    await pg2.goto(BASE + '?list=complete&question=202305', wait_until='networkidle'); await pg2.locator('#gearBtn').click(); await open_sec(pg2, 'sync')
    await pg2.locator('#gistToken').fill(TOKEN); await pg2.locator('#syncConnectBtn').click(); await pg2.wait_for_function("document.querySelector('#setMsg').textContent.includes('已连接')")
    ok('第二台设备: 找到已有 Gist（不重复创建）并拉取进度', sum(1 for l in gh.log if l[0] == 'POST') == posts and (await pg2.evaluate("CDGStore.get('gist')"))['gistId'] == gid and await pg2.locator('button[data-mark="unknown"]').get_attribute('aria-pressed') == 'true')
    # 两台设备各自改同一题 → 后改的胜出
    await pg2.locator('#syncOffBtn').evaluate('b=>b.closest(".popover").hidden=true')
    await pg2.locator('button[data-mark="mastered"]').click(); await pg2.wait_for_timeout(4000)
    await t('#gearBtn').click(); await open_sec(pg, 'sync'); await t('#syncNowBtn').click(); await pg.wait_for_function("document.querySelector('#setMsg').textContent.includes('同步完成')")
    r = await rec(); ok('两台设备: 同一题后改的一方胜出，复习日志合并', r['marks']['202305']['state'] == 'mastered' and len(r['srs']['202305']['logs']) >= 1)
    await ctx2.close()
    # 错误处理
    for mode, word, name in (('401', '令牌无效', '401'), ('500', '500', '服务器错误'), ('ratelimit', '次数已用完', '限流'), ('abort', '网络连接失败', '网络中断')):
        gh.mode = mode; await t('#syncNowBtn').click(); await pg.wait_for_timeout(500)
        ok(f'API 错误显示: {name}', word in await txt('#syncStatus') and t('#syncStatus.err'), await txt('#syncStatus'))
    gh.mode = 'ok'; await t('#syncNowBtn').click(); await pg.wait_for_timeout(500)
    ok('错误恢复后同步成功', '已同步' in await txt('#syncStatus'), await txt('#syncStatus'))
    # 离线
    await ctx.set_offline(True); await pg.wait_for_timeout(200); n0 = len(gh.log)
    await pg.mouse.click(400, 400); await t('button[data-mark="unknown"]').click(); await pg.wait_for_timeout(3600)
    await t('#gearBtn').click(); await open_sec(pg, 'sync')
    ok('离线: 改动保存在本地并提示离线', '离线' in await txt('#syncStatus') and len(gh.log) == n0 and (await rec())['marks']['202306']['state'] == 'unknown', await txt('#syncStatus'))
    await ctx.set_offline(False); await pg.wait_for_timeout(1500)
    ok('恢复联网: 自动补同步', gh.content(gid)['marks']['202306']['state'] == 'unknown' and '已同步' in await txt('#syncStatus'), await txt('#syncStatus'))
    # Gist 被删 → 重新创建
    del gh.gists[gid]; await t('#syncNowBtn').click(); await pg.wait_for_function("document.querySelector('#setMsg').textContent.includes('同步完成')"); await pg.wait_for_timeout(200)
    gid2 = (await pg.evaluate("CDGStore.get('gist')"))['gistId']
    ok('Gist 被删除: 自动重建并上传', gid2 != gid and gid2 in gh.gists and gh.content(gid2)['marks']['202306']['state'] == 'unknown', gid2)
    # 权限提醒
    gh.scopes = 'gist, repo'; await t('#syncNowBtn').click(); await pg.wait_for_timeout(500)
    ok('令牌权限超出 gist 时提醒', await t('#syncWarn').is_visible() and 'repo' in await txt('#syncWarn'), await txt('#syncWarn'))
    await t('#syncOn').scroll_into_view_if_needed(); await pg.screenshot(path='shots/sync-connected.png')
    # 断开
    await t('#syncOffBtn').click(); await pg.wait_for_timeout(200)
    ok('断开同步: 删除本机令牌、恢复连接表单、本地记录保留', await pg.evaluate("CDGStore.get('gist')") is None and await t('#syncOff').is_visible() and (await rec())['marks']['202306']['state'] == 'unknown')
    n0 = len(gh.log); await pg.mouse.click(400, 400); await t('button[data-mark="shaky"]').click(); await pg.wait_for_timeout(3600)
    ok('断开后不再请求 GitHub', len(gh.log) == n0)
    # 导出 / 记录码仍可用
    await t('#gearBtn').click(); await open_sec(pg, 'records'); await t('#genCodeBtn').click(); code = await t('#codeInput').input_value()
    ok('IndexedDB 下记录码仍可生成', code.startswith('CG1-'))
    await pg.screenshot(path='shots/sync-settings.png')
    ok('无页面错误', not pg.errs, str(pg.errs))
    await b.close()
  print(f'{sum(1 for r in R if r[1])}/{len(R)} passed')
  sys.exit(0 if all(r[1] for r in R) else 1)
asyncio.run(main())

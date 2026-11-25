"""FSRS 复习调度验收：评分 → 间隔预览/到期日更新 → 模拟时间到期 → 导出/导入往返、记录码往返、旧版记录兼容。
用法: python3 tools/verify_fsrs.py [base_url]"""
import asyncio, sys, json, re, datetime as dt
from playwright.async_api import async_playwright
from verify_support import idle
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
R = []
async def open_sec(p, key):
    """设置面板是折叠分组：用到某组控件前先展开它"""
    b = p.locator(f'#acc-{key}-btn')
    if await b.get_attribute('aria-expanded') != 'true': await b.click()

def ok(name, cond, detail=''):
    R.append((name, bool(cond), detail)); print(('PASS' if cond else 'FAIL'), name, detail)
T0 = dt.datetime(2026, 11, 10, 10, 0, tzinfo=dt.timezone(dt.timedelta(hours=9)))
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, timezone_id='Asia/Tokyo')
    await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.clock.install(time=T0)
    t = lambda s: pg.locator(s)
    async def txt(s): return (await t(s).first.inner_text()).strip()
    async def imp(f):
        await pg.evaluate("document.querySelector('#setMsg').textContent=''"); await t('#importFile').set_input_files(f)
        await pg.wait_for_function("document.querySelector('#setMsg').textContent.length>0")
    async def store():
        await idle(pg)  # 等待异步写入 IndexedDB
        return await pg.evaluate("__cdg.kv.get('rec').then(r=>r||{})")
    await pg.goto(BASE + '?list=complete&question=202301', wait_until='networkidle'); await pg.evaluate('localStorage.clear()'); await pg.reload(wait_until='networkidle')
    iv = {k: await txt(f'button[data-mark="{k}"] .iv') for k in ('unknown', 'shaky', 'mastered')}
    ok('新题: 按钮显示间隔预览', all(re.match(r'\d+天', v) for v in iv.values()), str(iv))
    ok('新题: 显示「未复习」', '未复习' in await txt('.card .due'))
    ok('复测 tab 无角标', await t('#dueBadge').is_hidden())
    # Hold a real application write at the storage adapter boundary. idle must not flush it.
    await idle(pg)
    await pg.evaluate("""() => {
      const kv = window.__cdg.kv, original = kv.set;
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      window.writeGate = {release, restore: () => { kv.set = original; }};
      kv.set = (key, value) => key === 'rec' ? gate.then(() => original(key, value)) : original(key, value);
      window.idleObserved = false;
    }""")
    # 评分：掌握
    await t('button[data-mark="mastered"]').click()
    await pg.evaluate("() => { window.__cdg.idle().then(() => { window.idleObserved = true; }); }")
    held = await pg.evaluate("async () => ({ready: window.idleObserved, stored: await window.__cdg.kv.get('rec'), frozen: Object.isFrozen(window.__cdg)})")
    ok('idle 是只读观察：挂起的写入尚未落库，也未被提前完成', not held['ready'] and not (held['stored'] or {}).get('srs') and held['frozen'], held)
    await pg.evaluate("() => { window.writeGate.restore(); window.writeGate.release(); }")
    await idle(pg)
    ok('idle 在真实写入完成后才返回', await pg.evaluate('window.idleObserved'))
    s = await store(); c = s['srs']['202301']['card']; due0 = c['due']
    ok('评分 掌握 → 存储 FSRS 卡片与日志', c['reps'] == 1 and len(s['srs']['202301']['logs']) == 1 and s['srs']['202301']['logs'][0]['rating'] == 3, json.dumps(c, ensure_ascii=False)[:160])
    days = round((dt.datetime.fromisoformat(due0.replace('Z', '+00:00')) - T0).total_seconds() / 86400)
    ok('到期日 = 预览的「掌握」间隔', f'{days}天' == iv['mastered'], f'{days}天 vs {iv["mastered"]}')
    dtxt = await txt('.card .due'); ok('卡片显示下次复习日期', '下次复习' in dtxt and f'{days} 天后' in dtxt, dtxt)
    tt = await t('button[data-mark="mastered"]').get_attribute('title'); ok('按钮悬停提示下次复习日期', '下次复习' in tt, tt)
    ok('标记仍作为标签保留', await t('button[data-mark="mastered"]').get_attribute('aria-pressed') == 'true')
    # 第二题：不会（1 天）
    await t('#nextBtn').click(); q2 = int(re.search(r'question=(\d+)', pg.url).group(1))
    await t('button[data-mark="unknown"]').click()
    s = await store(); ok('评分 不会 → Again', s['srs'][str(q2)]['logs'][-1]['rating'] == 1 and s['srs'][str(q2)]['card']['scheduled_days'] == 1)
    await t('#tabs button[data-tab="retest"]').click()
    ok('今日待复习: 当天无到期', await t('#cards .empty').count() == 1 and await t('#dueBadge').is_hidden())
    # 模拟 1 天后
    await pg.clock.set_fixed_time(T0 + dt.timedelta(days=1, hours=1)); await pg.reload(wait_until='networkidle')
    ok('1 天后: 角标=1', (await txt('#dueBadge')) == '1', await txt('#dueBadge'))
    ok('1 天后: 今日待复习显示「不会」题', await t('.card').count() == 1 and f'question={q2}' in pg.url, await txt('#sectionLabel'))
    ok('到期卡片标红「今日待复习」', '今日待复习' in await txt('.card .due') and await t('.card .due.now').count() == 1, await txt('.card .due'))
    # 模拟到第一题到期
    await pg.clock.set_fixed_time(T0 + dt.timedelta(days=days, hours=1)); await pg.reload(wait_until='networkidle')
    ids = await pg.evaluate("[...document.querySelectorAll('.card')].map(c=>+c.dataset.id)")
    await pg.goto(BASE + '?list=complete&question=202301', wait_until='networkidle')
    iv3 = {k: await txt(f'button[data-mark="{k}"] .iv') for k in ('unknown', 'shaky', 'mastered')}
    ok('到期当天: 间隔预览随记忆状态更新', iv3 != iv, f'{iv} -> {iv3}')
    await pg.goto(BASE + '?tab=retest', wait_until='networkidle')
    ok(f'{days} 天后: 两题都到期, 角标=2', (await txt('#dueBadge')) == '2', await txt('#dueBadge'))
    ok('按到期时间排序(早到期在前)', (await txt('#pos')) == '1 / 2' and f'question={q2}' in pg.url, pg.url)
    # 在待复习里评分 → 当天保留、不自动跳题，并能修正评分
    await t('button[data-mark="mastered"]').click()
    ok('待复习里评分后保留并停在原题，红点减1', (await txt('#dueBadge')) == '1' and (await txt('#pos')) == '1 / 2' and f'question={q2}' in pg.url, pg.url)
    s = await store(); ok('复习日志累计', len(s['srs'][str(q2)]['logs']) == 2)
    reps = s['srs'][str(q2)]['card']['reps']
    log_id = s['srs'][str(q2)]['logs'][-1]['id']
    await pg.reload(wait_until='networkidle')
    ok('刷新后当天已评分题仍保留，红点仍只计未复习', (await txt('#dueBadge')) == '1' and (await txt('#pos')) == '1 / 2' and f'question={q2}' in pg.url)
    await t('#tabs button[data-tab="bank"]').click(); await t('#tabs button[data-tab="retest"]').click()
    ok('重新进入复测仍保留', (await txt('#pos')) == '1 / 2' and f'question={q2}' in pg.url and (await txt('#dueBadge')) == '1')
    await pg.set_viewport_size({'width': 390, 'height': 844})
    await pg.clock.set_fixed_time(T0 + dt.timedelta(days=days, hours=1, minutes=1))
    await t('button[data-mark="unknown"]').click()
    s = await store(); revised = s['srs'][str(q2)]
    ok('移动端可修改当天评分，不累计次数或日志', revised['card']['reps'] == reps and len(revised['logs']) == 2 and revised['logs'][-1]['id'] == log_id and revised['logs'][-1]['rating'] == 1)
    await pg.clock.set_fixed_time(T0 + dt.timedelta(days=days, hours=1, minutes=2))
    await t('button[data-mark="mastered"]').click()
    s = await store()
    ok('反复修改不累计遗忘次数', s['srs'][str(q2)]['card']['lapses'] == 0 and s['srs'][str(q2)]['card']['reps'] == reps)
    ok('同日修正评分不重复扣减红点', (await txt('#dueBadge')) == '1' and (await txt('#pos')) == '1 / 2')
    await pg.reload(wait_until='networkidle')
    ok('移动端刷新后修改结果仍在', f'question={q2}' in pg.url and await t('button[data-mark="mastered"]').get_attribute('aria-pressed') == 'true')
    await t('.unmark').click()
    ok('取消标记不回退调度，已评分题仍保留且红点不回升', (await txt('#dueBadge')) == '1' and (await txt('#pos')) == '1 / 2' and f'question={q2}' in pg.url and await t('.unmark').count() == 0)
    await t('button[data-mark="mastered"]').click()
    s = await store()
    ok('取消后再标记仍是同日修正', s['srs'][str(q2)]['card']['reps'] == reps and len(s['srs'][str(q2)]['logs']) == 2 and (await txt('#dueBadge')) == '1')
    await pg.set_viewport_size({'width': 1440, 'height': 900})
    await t('#nextBtn').click()

    # 设置：目标记忆率
    await t('#gearBtn').click(); await open_sec(pg, 'review')
    ok('设置: 目标记忆率默认 0.90', (await txt('#retentionVal')) == '0.90')
    before = await txt('button[data-mark="mastered"] .iv')
    await t('#retention').fill('0.8'); await t('#retention').dispatch_event('change')
    s = await store(); ok('设置: 目标记忆率改为 0.80 并保存', s['retention'] == 0.8 and (await txt('#retentionVal')) == '0.80')
    after = await txt('button[data-mark="mastered"] .iv'); ok('记忆率降低 → 间隔变长', int(re.sub(r'\D', '', after) or 0) >= int(re.sub(r'\D', '', before) or 0) and after != before, f'{before} -> {after}')
    mn, mx = await t('#retention').get_attribute('min'), await t('#retention').get_attribute('max'); ok('记忆率范围 0.80–0.95', (mn, mx) == ('0.80', '0.95'))
    # 导出 JSON
    await open_sec(pg, 'records')
    async with pg.expect_download() as d: await t('#exportBtn').click()
    path = await (await d.value).path(); data = json.load(open(path))
    await open_sec(pg, 'review')
    ok('导出 JSON 含 srs/retention (v2)', data['version'] == 2 and '202301' in data['srs'] and data['retention'] == 0.8)
    # 重置
    await t('#resetSrsBtn').click(); ok('重置: 先出现确认', await t('#resetConfirm').is_visible())
    await t('#resetNo').click(); ok('重置: 取消不清空', len((await store())['srs']) == 2)
    await t('#resetSrsBtn').click(); await t('#resetYes').click()
    s = await store(); ok('重置: 清空复习进度、保留标记', s['srs'] == {} and len(s['marks']) == 2, json.dumps(s['marks']))
    # 导入 JSON 往返
    await imp(path)
    s = await store(); ok('导入 JSON: 恢复复习卡片与日志', len(s['srs']) == 2 and len(s['srs'][str(q2)]['logs']) == 2, json.dumps({k: len(v['logs']) for k, v in s['srs'].items()}) + json.dumps({k: len(v['logs']) for k, v in data['srs'].items()}))
    await pg.goto(BASE + '?tab=retest', wait_until='networkidle')
    ok('导入后刷新复测：已评分题仍在列表，红点只计未复习', (await txt('#dueBadge')) == '1' and (await txt('#pos')) == '1 / 2')
    await t('#gearBtn').click()
    await imp(path)
    s = await store(); ok('重复导入: 日志按 id 去重', len(s['srs'][str(q2)]['logs']) == 2)
    # 记录码往返
    await open_sec(pg, 'records'); await t('#genCodeBtn').click(); code = await t('#codeInput').input_value()
    await open_sec(pg, 'review'); await t('#resetSrsBtn').click(); await t('#resetYes').click()
    await open_sec(pg, 'records'); await t('#codeInput').fill(code); await t('#importCodeBtn').click()
    s = await store(); ok('记录码往返: 恢复复习卡片', len(s['srs']) == 2 and s['srs'][str(q2)]['card']['reps'] == 2, await txt('#setMsg'))
    # 旧版 v1 记录兼容
    v1 = {'app': 'control-daguan', 'version': 1, 'favorites': [202305], 'marks': {'202305': {'state': 'shaky', 'at': 1}}, 'history': []}
    open('/tmp/v1.json', 'w').write(json.dumps(v1)); await imp('/tmp/v1.json')
    s = await store(); ok('导入旧版 v1 记录: 标记合并、复习进度不受影响', s['marks'].get('202305', {}).get('state') == 'shaky' and len(s['srs']) == 2, await txt('#setMsg'))
    await pg.evaluate("localStorage.setItem('control-daguan:v1', JSON.stringify({favorites:[202301],marks:{'202301':{state:'unknown',at:1}},history:[]}))"); await pg.reload(wait_until='networkidle')
    s = await store(); ok('旧版 localStorage 记录并入 IndexedDB 后删除旧键', await pg.evaluate("localStorage.getItem('control-daguan:v1')") is None and len(s['srs']) == 2 and not errs, str(errs))
    await pg.goto(BASE + '?list=complete&question=202301', wait_until='networkidle'); await pg.clock.set_fixed_time(T0)
    # 学习日分界：凌晨 2 点前仍算前一天
    ctx2 = await b.new_context(viewport={'width': 1440, 'height': 900}, timezone_id='Asia/Tokyo'); p2 = await ctx2.new_page()
    p2.on('pageerror', lambda e: errs.append(str(e)))
    J = dt.timezone(dt.timedelta(hours=9)); N0 = dt.datetime(2026, 11, 12, 23, 0, tzinfo=J)
    await p2.clock.install(time=N0)
    await p2.goto(BASE + '?list=complete&question=202301', wait_until='networkidle'); await p2.evaluate('localStorage.clear()'); await p2.reload(wait_until='networkidle')
    await p2.locator('button[data-mark="unknown"]').click(); await idle(p2)
    async def badge():
        await p2.goto(BASE + '?tab=retest', wait_until='networkidle'); bd = p2.locator('#dueBadge')
        return '' if await bd.is_hidden() else (await bd.inner_text()).strip()
    await p2.clock.set_fixed_time(dt.datetime(2026, 11, 13, 1, 30, tzinfo=J))
    ok('学习日: 次日 01:30 仍算当天，昨晚 23:00 评「不会」的题未到期', await badge() == '')
    await p2.goto(BASE + '?list=complete&question=202301', wait_until='networkidle')
    d1 = (await p2.locator('.card .due').first.inner_text()).strip()
    ok('学习日: 01:30 时显示「1 天后」', '1 天后' in d1 and '11月13日' in d1, d1)
    await p2.clock.set_fixed_time(dt.datetime(2026, 11, 13, 2, 30, tzinfo=J))
    ok('学习日: 02:30 换日后到期，角标=1', await badge() == '1')
    await p2.clock.set_fixed_time(dt.datetime(2026, 11, 14, 1, 0, tzinfo=J))
    await p2.goto(BASE + '?list=complete&question=202301', wait_until='networkidle')
    d2 = (await p2.locator('.card .due').first.inner_text()).strip()
    ok('学习日: 11-14 01:00 仍算 13 日，显示今日待复习', '今日待复习' in d2, d2)
    await p2.locator('button[data-mark="mastered"]').click(); await idle(p2)
    await p2.goto(BASE + '?tab=retest', wait_until='networkidle')
    ok('凌晨评分后仍在当天复测集合，红点已清除', await p2.locator('#dueBadge').is_hidden() and await p2.locator('.card').count() == 1)
    await p2.clock.pause_at(dt.datetime(2026, 11, 14, 1, 59, 59, tzinfo=J))
    await p2.reload(wait_until='networkidle')
    await p2.clock.fast_forward(1000)
    ok('开着页面跨 2AM 自动移除昨日已评分题', await p2.locator('#dueBadge').is_hidden() and await p2.locator('#cards .empty').count() == 1)
    await ctx2.close()
    # A failed storage write must reject idle even though the application displays its normal toast.
    await idle(pg)
    await pg.evaluate("() => { window.originalSet = window.__cdg.kv.set; window.__cdg.kv.set = () => Promise.reject(new Error('injected write failure')); }")
    await t('.mk.fav').click()
    failure = await idle(pg, allow_failure=True)
    ok('idle 不把失败的保存当成成功完成', failure and any('injected write failure' in cause for cause in failure['causes']) and '未能保存' in await txt('#toast'), failure)
    await pg.evaluate("() => { window.__cdg.kv.set = window.originalSet; }")
    await t('.mk.fav').click(); await idle(pg)
    ok('后续成功保存形成新的 idle 周期，失败不会永久挂住', await pg.evaluate("window.__cdg.kv.get('rec').then(r => !!r)"))
    ok('无页面错误', not errs, str(errs))
    await b.close()
  print(f'{sum(1 for r in R if r[1])}/{len(R)} passed')
  sys.exit(0 if all(r[1] for r in R) else 1)
asyncio.run(main())

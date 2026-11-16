// 第 7 项：eslint 项目约定确实会报错，且报错信息写明替代 API；允许的写法不误报
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const eslint = new ESLint();
const lint = async (code, file = 'public/src/ui/sample.js') => (await eslint.lintText(code, { filePath: file }))[0].messages;

const BAD = [
  ['innerHTML 赋值', 'export const f = el => { el.innerHTML = "<b>x</b>"; };', /setHTML\(el, html`…`\)/],
  ['outerHTML 赋值', 'export const f = el => { el.outerHTML = "<b>x</b>"; };', /setHTML/],
  ['insertAdjacentHTML', 'export const f = el => el.insertAdjacentHTML("beforeend", "<i></i>");', /insertHTML\(el, where, html`…`\)/],
  ['裸 setTimeout', 'export const f = fn => setTimeout(fn, 100);', /after\(ms, fn\).*debounce\(fn, ms\)/],
  ['window.setTimeout', 'export const f = fn => window.setTimeout(fn, 100);', /core\/timers\.js/],
  ['clearTimeout', 'export const f = t => clearTimeout(t);', /core\/timers\.js/],
  ['DOM 节点 _私有字段', 'export const f = ta => { ta._pv = 1; };', /WeakMap/],
];
for (const [name, code, msg] of BAD) test(`报错：${name}`, async () => {
  const m = await lint(code);
  assert.ok(m.length >= 1, `应当报错：${code}`);
  assert.match(m.map(x => x.message).join('\n'), msg);
});

const OK = [
  ['html`` + setHTML', "import { html, setHTML } from './html.js'; export const f = (el, t) => setHTML(el, html`<b>${t}</b>`);"],
  ['after / debounce', "import { after, debounce } from '../core/timers.js'; export const f = fn => [after(10, fn), debounce(fn, 10)];"],
  ['this._私有方法', 'export class A { go() { this._x = 1; } }'],
  ['window.__cdg 测试钩子', 'window.__cdg = {};'],
];
for (const [name, code] of OK) test(`不误报：${name}`, async () => assert.deepEqual((await lint(code)).map(x => x.message), []));

test('唯一的例外文件：ui/html.js 可写 innerHTML，core/timers.js 可用 setTimeout', async () => {
  assert.deepEqual(await lint('export const s = (el, h) => { el.innerHTML = h; };', 'public/src/ui/html.js'), []);
  assert.deepEqual(await lint('export const a = (ms, fn) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); };', 'public/src/core/timers.js'), []);
});
test('整个仓库 lint 无错误', async () => {
  const res = await eslint.lintFiles(['.']);
  const errs = res.flatMap(r => r.messages.map(m => `${r.filePath}:${m.line} ${m.message}`));
  assert.deepEqual(errs, []);
});

// html`` 转义助手与定时器助手的行为
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, trusted, setHTML, insertHTML, Html } from '../public/src/ui/html.js';
import { after, debounce } from '../public/src/core/timers.js';

test('插值按文本转义，Html 原样拼接', () => {
  const evil = '<img src=x onerror=alert(1)> & "q"';
  assert.equal(String(html`<p title="${evil}">${evil}</p>`), '<p title="&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;">&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;</p>');
  assert.equal(String(html`<div>${html`<b>${'<'}</b>`}${trusted('<i>k</i>')}</div>`), '<div><b>&lt;</b><i>k</i></div>');
});
test('数组逐项拼接（不会把已生成的 HTML 再转义一遍），null/undefined 为空，布尔与数字照常输出', () => {
  assert.equal(String(html`<ul>${['a<', 'b'].map(x => html`<li>${x}</li>`)}</ul>`), '<ul><li>a&lt;</li><li>b</li></ul>');
  assert.equal(String(html`${null}${undefined}|${false}|${true}|${0}`), '|false|true|0');
});
test('setHTML / insertHTML 只接受 Html，普通字符串直接抛错', () => {
  const el = { innerHTML: '', insertAdjacentHTML(w, s) { this.ins = [w, s]; } };
  setHTML(el, html`<b>${'x'}</b>`); assert.equal(el.innerHTML, '<b>x</b>');
  insertHTML(el, 'beforeend', html`<i></i>`); assert.deepEqual(el.ins, ['beforeend', '<i></i>']);
  assert.throws(() => setHTML(el, '<b>x</b>'), TypeError);
  assert.throws(() => insertHTML(el, 'beforeend', '<i></i>'), TypeError);
  assert.ok(html`` instanceof Html);
});
test('after：到时执行，取消后不执行', async () => {
  const hits = []; after(5, () => hits.push('a')); const cancel = after(5, () => hits.push('b')); cancel();
  await new Promise(r => after(20, r)); assert.deepEqual(hits, ['a']);
});
test('debounce：只执行最后一次调用；cancel 取消；pending 反映状态', async () => {
  const hits = []; const d = debounce(v => hits.push(v), 10);
  d(1); d(2); d(3); assert.equal(d.pending(), true);
  await new Promise(r => after(30, r)); assert.deepEqual(hits, [3]); assert.equal(d.pending(), false);
  d(4); d.cancel(); await new Promise(r => after(30, r)); assert.deepEqual(hits, [3]);
});

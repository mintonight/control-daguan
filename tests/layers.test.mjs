// 模块分层规则（第 6 项）：core/srs/sync 不碰 DOM 也不依赖 ui；ui 只经 store 读写数据，不直接调用 srs/sync。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../public/src');
const files = readdirSync(SRC, { recursive: true }).filter(f => f.endsWith('.js')).map(f => f.split('\\').join('/'));
const layerOf = f => (f.includes('/') ? f.split('/')[0] : 'main');
const ALLOWED = {
  core: ['core'],
  srs: ['core', 'srs'],
  sync: ['core', 'sync'],
  store: ['core', 'srs', 'sync', 'store'],
  ui: ['core', 'store', 'ui'],
  main: ['core', 'srs', 'sync', 'store', 'ui'],
};
// 纯逻辑层不得引用的浏览器全局（store 可以用 localStorage/navigator/BroadcastChannel，但不碰 document）
const BANNED = {
  core: ['document', 'window', 'navigator', 'localStorage', 'location', 'addEventListener'],
  srs: ['document', 'window', 'navigator', 'localStorage', 'location', 'addEventListener'],
  sync: ['document', 'window', 'navigator', 'localStorage', 'location', 'addEventListener'],
  store: ['document', 'location'],
};
const code = f => readFileSync(join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, m => (m.startsWith("'./") || m.startsWith("'../") ? m : "''"));
const imports = f => [...readFileSync(join(SRC, f), 'utf8').matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]);

test('src/ 下有模块可检查', () => assert.ok(files.length >= 10, files.join(',')));
for (const f of files) {
  const layer = layerOf(f);
  test(`${f}: 只依赖 ${ALLOWED[layer].join('/')}`, () => {
    for (const spec of imports(f)) {
      assert.ok(spec.startsWith('.') && spec.endsWith('.js'), `${f} 导入 ${spec}：只允许带 .js 的相对路径`);
      const target = relative(SRC, resolve(dirname(join(SRC, f)), spec)).split('\\').join('/');
      assert.ok(files.includes(target), `${f} 导入了不存在的 ${spec}`);
      assert.ok(ALLOWED[layer].includes(layerOf(target)), `${f}（${layer}）不得导入 ${target}（${layerOf(target)}）`);
    }
  });
  if (BANNED[layer]) test(`${f}: 不引用 ${BANNED[layer].join('/')}`, () => {
    const c = code(f);
    for (const g of BANNED[layer]) assert.ok(!new RegExp(`(?<![.\\w$])${g}\\b`).test(c), `${f}（${layer}）引用了 ${g}`);
  });
}

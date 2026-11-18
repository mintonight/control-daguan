import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url));

test('vendored copy-tex is the official KaTeX 0.16.47 contrib build, loaded after KaTeX', () => {
  // sha256 of katex@0.16.47 dist/contrib/copy-tex.min.js (npm integrity sha512-Eeo8Ys1d...).
  assert.equal(createHash('sha256').update(read('public/vendor/katex/contrib/copy-tex.min.js')).digest('hex'), 'c571c49b520cb8e9040287338286b21783e39b476660b8b56d9e1c037eeaeaff');
  assert.match(read('public/vendor/katex/katex.min.js').toString(), /version:"0\.16\.47"/);
  const html = read('public/index.html').toString();
  const katex = html.indexOf('src="vendor/katex/katex.min.js"'), copy = html.indexOf('src="vendor/katex/contrib/copy-tex.min.js"');
  assert.ok(katex > 0 && copy > katex);
  assert.match(read('public/sw.js').toString(), /"\.\/vendor\/katex\/contrib\/copy-tex\.min\.js": "sha256-/);
});

test('notes sanitizer keeps only text TeX annotations for copy-tex', () => {
  const src = read('public/src/ui/note-markdown.js').toString();
  assert.match(src, /ADD_TAGS: \['semantics', 'annotation'\]/);
  assert.doesNotMatch(src, /annotation-xml'/);
  assert.match(src, /n\.nodeName === 'annotation' && n\.childElementCount\) n\.replaceChildren\(n\.textContent\)/);
});

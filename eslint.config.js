// ESLint 扁平配置：除常规检查外，三条项目约定（报错信息写明替代 API）
import js from '@eslint/js';
import globals from 'globals';

const HTML_SINK = '直接写 HTML 会绕过转义：改用 ui/html.js 的 setHTML(el, html`…`) 或 insertHTML(el, where, html`…`)';
const TIMER = '不要直接用浏览器定时器：改用 core/timers.js 的 after(ms, fn)（返回取消函数）或 debounce(fn, ms)';
const DOM_PRIVATE = '不要在对象（尤其 DOM 节点）上挂 _私有字段：改用模块内的 WeakMap / Map（以节点或题号为键）保存状态';

export const projectRules = {
  'no-restricted-syntax': ['error',
    { selector: "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]", message: HTML_SINK },
    { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: HTML_SINK },
    { selector: "CallExpression[callee.property.name=/^(setTimeout|clearTimeout|setInterval|clearInterval)$/]", message: TIMER },
    { selector: "AssignmentExpression > MemberExpression.left[property.name=/^_[^_]/]:not([object.type='ThisExpression'])", message: DOM_PRIVATE },
  ],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-restricted-globals': ['error', ...['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'].map(name => ({ name, message: TIMER }))],
};

export default [
  { ignores: ['public/vendor/**', 'node_modules/**', 'shots/**'] },
  js.configs.recommended,
  {
    files: ['public/src/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser, katex: 'readonly', marked: 'readonly', DOMPurify: 'readonly', FSRS: 'readonly', idbKeyval: 'readonly' } },
    rules: projectRules,
  },
  // 唯一允许直接使用这些 API 的地方
  { files: ['public/src/ui/html.js'], rules: { 'no-restricted-syntax': 'off' } },
  { files: ['public/src/core/timers.js'], rules: { 'no-restricted-globals': 'off' } },
  { files: ['public/sw.js'], languageOptions: { sourceType: 'script', globals: globals.serviceworker } },
  { files: ['tests/**/*.mjs', 'tools/**/*.mjs', 'eslint.config.js'], languageOptions: { sourceType: 'module', globals: globals.node } },
];

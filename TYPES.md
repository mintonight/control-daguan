# JavaScript 类型检查范围

`npm run types` 执行 `tsc --noEmit --allowJs --checkJs -p tsconfig.json`。
CI 在 Node 测试和 ESLint 后运行同一命令，不生成编译产物。

## 已检查的代码

`tsconfig.json` 对以下模块启用 `strict: true`，包含隐式参数类型和空值检查。

- `public/src/core/*.js` 定义记录、卡片、日志和题目的 JSDoc 类型，检查合并、学习日、勘误决策、定时器及偏好 setter。
- `public/src/srs/fsrs.js` 使用 `ts-fsrs` 自带的类型，检查评分、调度输入和日期序列化。
- `public/src/store/library.js` 将网络 JSON 当作 `unknown`，经 `core/question.js` 验证后才缓存题库和题目详情。

`core/types.js` 是共享类型定义。`Card` 的持久化日期是字符串，FSRS 内存卡片的日期是 `Date`。
旧卡片可以没有 `learning_steps`。适配器只在内存中补零，不重写原卡片。
`Rec` 保持原有字段，`normRec` 的静态输入契约为 `Partial<Rec>`，继续按原规则补默认值。

## 尚未检查的代码

这不是全应用类型迁移。`main.js`、`ui/`、`sync/gist.js`、`store/records.js` 和 `store/kv.js` 不在检查范围。
这些模块仍有动态 DOM、存储和 Gist JSON 路径。
尤其是 `normRec` 不等于外部记录文件的完整运行时验证器，原有的记录导入和同步验证未被替换。
`store/records.js` 的偏好接口改用具名 setter，实际赋值及运行时合法值检查在已检查的 `core/preferences.js` 中。

## 验证

`tests/type-contracts.test.mjs` 同时编译正常模块和错误示例。
错误示例必须拒绝非法显示模式、字号、评分、持久化日期、题目文本和收藏题号，共六处类型错误。
测试不使用 `ts-ignore`、`ts-nocheck` 或 `any` 来跳过检查。

`tests/domain-boundaries.test.mjs` 检查全部生成题目、错误 JSON、偏好 setter 和旧版记录。
旧记录测试覆盖缺少 `notes`、`updated` 及 `learning_steps` 的情况。
浏览器套件继续覆盖 localStorage 迁移、旧 v2 导入、Gist 同步，以及一次导入点击只打开一次文件选择器。

IndexedDB、localStorage、BroadcastChannel、Gist 和导入导出格式均未改名或换版。

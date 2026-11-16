# 功能与验收入口

这是当前站点的功能索引。每行对应已存在的界面动作和测试断言，不代表所有浏览器或所有输入都已覆盖。
命令在仓库根目录执行，要求 `http://localhost:8765/` 已提供 `public/`。本地服务命令是 `python3 -m http.server 8765 -d public`。
浏览器验收使用 Python、Playwright、Pillow 和 `/usr/bin/google-chrome`。Node 检查使用 `npm ci` 安装的依赖。

## 功能表

| 功能 | 入口 | 操作 | 验收断言 | 完整测试命令 |
| --- | --- | --- | --- | --- |
| 题单和专题目录 | 左侧题单、分类树 | 切换真题年份、重点题目，展开分类并选子类 | 题单和 URL 更新；重点题目按专题分组；选中分类对应题目 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 逐题阅读和链接定位 | 上一题、下一题、地址栏 | 翻题、跨小节，使用左右方向键，打开 ?list=complete&question=202402 | 题目位置和 URL 一致，分类边界可进入下一小节 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 搜索 | 搜索框 | 输入年份、不存在的词，再清空 | 年份结果正确；无结果时显示提示；清空后恢复 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 答案、解析和原图 | 题目卡片 | 展开答案和解析，切换文字或原图，再收起 | KaTeX 渲染；原图按需加载；两种内容可同时展开；收起移除内容 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 图片放大和勘误 | 题图、原图、勘误提示 | 点击图片放大，按 Escape 关闭，切换已改正与未改正内容 | 灯箱开关正确；已改正文字不重复显示原图勘误，未改正文字保留提示 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 收藏和学习标记 | 卡片的收藏、不会、不熟练、掌握 | 收藏、切换互斥标记、取消标记、刷新页面 | 收藏和标记持久化；目录计数跟随更新；收藏页可取消收藏 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 复测列表和历史 | 复测页签 | 切换今日待复习与不熟练·不会，展开历史 | 未到期新评分不进入今日列表；标记掌握后移出不熟练列表；历史可展开 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 阅读模式和字号 | 设置 → 阅读 | 切换单题、多题及四档字号 | 卡片数量、翻节行为和计算字号符合选择 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 学习记录 JSON 和记录码 | 设置 → 学习记录 | 导出、导入 JSON，生成和导入 CG1 记录码，尝试损坏输入 | 可往返恢复记录；损坏输入报错；导入后落库 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 一次点击导入 | 设置 → 学习记录 → 导入 JSON | 点击一次导入按钮 | 只打开一次文件选择器 | `python3 tools/verify_all.py http://localhost:8765/ --only settings` |
| 设置分组和键盘 | 顶栏设置按钮 | 展开分组，使用 Enter、Space、方向键、Home，关闭后重开或刷新 | 一次只开一组；aria 状态正确；记住本机分组；提示不被折叠隐藏 | `python3 tools/verify_all.py http://localhost:8765/ --only settings` |
| 手机目录 | 手机宽度的目录按钮 | 打开目录抽屉并选择分类 | 侧栏默认隐藏；选择分类后抽屉关闭 | `python3 tools/verify_all.py http://localhost:8765/ --only main` |
| 手机设置 | 手机宽度的设置按钮 | 逐组打开设置 | 设置及控件在视口内，无横向溢出 | `python3 tools/verify_all.py http://localhost:8765/ --only settings` |
| FSRS 调度 | 评分按钮、复测页签 | 评分、查看间隔预览，模拟到期和学习日分界 | 生成卡片与日志；到期角标和日期在分界前后正确 | `python3 tools/verify_all.py http://localhost:8765/ --only fsrs` |
| 复习设置和进度重置 | 设置 → 复习 | 调整目标记忆率，确认重置，再导入备份 | 记忆率生效；重置清空复习进度但保留标记；备份恢复卡片和日志 | `python3 tools/verify_all.py http://localhost:8765/ --only fsrs` |
| 旧学习记录兼容 | 导入旧版记录 | 导入旧 v1 记录 | 旧标记合并，现有复习进度不受影响，导出和记录码往返兼容 | `python3 tools/verify_all.py http://localhost:8765/ --only fsrs` |
| 逐题 Markdown 笔记 | 题目卡片 → 笔记 | 输入标题、列表、代码、表格、公式，切换预览或双击编辑 | Markdown 和 KaTeX 正确；原始 HTML 不执行；每题独立保存并显示笔记标识 | `python3 tools/verify_all.py http://localhost:8765/ --only notes` |
| 笔记防丢和查找 | 笔记编辑器、搜索框 | 输入后立刻翻题或刷新；搜索笔记内容 | 文字不丢失；自动保存完成后落库；搜索可找到笔记 | `python3 tools/verify_all.py http://localhost:8765/ --only notes` |
| 笔记清空和备份 | 笔记清空按钮、学习记录 | 二次确认清空；导出和导入 JSON 或记录码 | 清空确认有有效期；笔记随备份往返；旧备份不会清掉较新笔记 | `python3 tools/verify_all.py http://localhost:8765/ --only notes` |
| 云同步连接和自动上传 | 设置 → 云同步 | 连接测试令牌，修改标记或收藏，点击立即同步 | 模拟私密 Gist 创建、自动防抖上传和远端合并；状态更新；令牌不进学习记录导出 | `python3 tools/verify_all.py http://localhost:8765/ --only sync` |
| 同步失败和断开 | 设置 → 云同步 | 模拟授权、限流、离线故障，断开后继续本地操作 | 显示对应错误；失败 idle 拒绝；断开后不再发同步请求；本地记录保留 | `python3 tools/verify_all.py http://localhost:8765/ --only sync` |
| 旧存储迁移 | 本机旧记录 | 加载旧 localStorage 记录及较新 IndexedDB 记录 | 迁移后删除旧键；较新记录不被旧记录覆盖 | `python3 tools/verify_all.py http://localhost:8765/ --only sync` |
| 笔记云端合并 | 设置 → 云同步、笔记编辑器 | 在模拟远端和本地分别编辑或清空笔记 | 逐题保留较新版本；较新的清空不会被旧远端笔记复活 | `python3 tools/verify_all.py http://localhost:8765/ --only notes` |
| 离线缓存和清除 | 设置 → 离线与安装 | 下载全部离线资源、断网阅读，再清除缓存 | 已缓存答案可离线读；清除后未缓存内容提示失败；GitHub API 不入缓存 | `python3 tools/verify_all.py http://localhost:8765/ --only pwa` |
| 安装入口和版本升级 | 安装按钮、更新提示 | 模拟安装提示和 standalone，点击版本更新 | 安装入口随状态变化；旧提交 SW 可升级到当前产物；失败安装保留旧缓存；更新后离线冷启动 | `python3 tools/verify_all.py http://localhost:8765/ --only pwa` |

同源跨标签页通知存在于 `store/records.js`，但当前浏览器套件没有单独证明实时跨标签页更新。本表不把第二个隔离上下文的模拟设备测试写成跨标签页覆盖。

## 自动明暗外观和截图

站点跟随系统 `prefers-color-scheme`，没有独立的主题切换按钮。下面的命令检查设置并生成截图，同时断言实际 CSS 明暗颜色：

```sh
python3 tools/verify_all.py http://localhost:8765/ --only settings --shots
```

截图覆盖 light、dark 与 desktop 1440×900、mobile 390×844 的四种组合。
每种组合有 question、answer-original、notes、settings、navigation 五个状态，共20张 PNG。
`shots/snapshots/manifest.json` 列出路径、视口、状态和 SHA-256。截图和报告均在 Git 忽略的 `shots/` 中。

截图固定日期、语言、时区和像素比例，等待应用空闲、图片加载、字体就绪和布局稳定，关闭动画、平滑滚动和光标，移开鼠标悬停。
笔记示例只来自 `tests/fixtures/snapshot-note.md`，每种组合使用全新浏览器上下文。
截图上下文阻断所有网络写请求和站外请求，不读取账户或令牌，也不连接真实云同步。
截图中禁用 Service Worker，避免后台安装改变画面；真实 SW 行为由 pwa 套件单独验证。
在相同 Chrome 和字体环境中可以比较截图哈希。跨操作系统、字体或浏览器版本不保证逐像素相同。

## 统一执行和退出状态

```sh
python3 tools/verify_all.py http://localhost:8765/
python3 tools/verify_all.py http://localhost:8765/ --shots
```

未指定 `--only` 时依次运行 main、fsrs、sync、notes、settings、pwa 六套验收。
`--only` 只运行选中的一套；未知名称退出码为2，套件不启动，上次报告不改写。pwa 使用自己启动的临时子路径服务器，不复用传入端口。
同步与笔记套件的 GitHub 请求由本地 FakeGitHub 拦截，使用合成令牌，不需要真实凭据。

报告固定写入 `shots/verification/report.json`，每套输出写入同目录的 `<suite>.log`。
报告只列本次选择的套件；目录中可能留有之前运行的其他日志。
失败或异常不会跳过后续套件。单套超时上限为300秒，超时会终止该套进程组。
成功退出0；验收、异常、超时或截图失败退出1；参数错误退出2；用户中断退出130，后续任务标为 skipped。
只有选定套件全部通过时才生成 `--shots` 截图，失败报告不会把旧截图列作本次产物。

## 其他检查

```sh
npm test
npm run lint
npm run types
npm run check:waits
python3 tools/build_data.py
python3 tools/build_precache.py
git diff --exit-code -- public
```

`npm test` 包含领域性质、数据边界、计时任务、生成器以及统一入口的故障报告测试。
`npm run types` 只覆盖 [TYPES.md](TYPES.md) 中列明的范围，不是整个应用的类型覆盖。
固定等待检查没有遗留脚本例外。预缓存的生成和真实升级保证见 [PWA.md](PWA.md)，`idle()` 的范围见 [ASYNC.md](ASYNC.md)。

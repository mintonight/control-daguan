/* 入口：把题库、学习记录、界面接起来。 */
import * as store from './store/records.js';
import { kv } from './store/kv.js';
import { lib, loadLibrary } from './store/library.js';
import { mergeRecords, canon, syncPart, normalizeNotes } from './core/merge.js';
import { bind, render, readURL, renderTree } from './ui/view.js';
import { bindSettings, syncUI } from './ui/settings.js';
import { setNoteHooks, flushNotes } from './ui/notes-editor.js';
import { startPWA } from './ui/pwa.js';
import { $, toast } from './ui/dom.js';

// 测试入口（Playwright 用例读取本地存储、调用纯函数）；应用代码不使用
window.__cdg = { kv, mergeRecords, canon, syncPart, normalizeNotes };

store.setHooks({ changed: render, saveFailed: () => toast('浏览器未能保存进度，本次更改未保存，请重试。'), syncStatus: syncUI });
setNoteHooks({ noteSaved: renderTree });

Promise.all([loadLibrary(), store.init()]).then(async () => {
  store.restoreDrafts();
  readURL(); bind(); bindSettings({ render }); render();
  if (store.migrated) toast('学习记录已迁移到 IndexedDB');
  await store.initSync();
  startPWA({ getLib: () => lib, flush: async () => { flushNotes(); await store.persist(); } });
}).catch(() => { $('#cards').innerHTML = '<div class="empty">静态文件读取失败，请刷新重试。</div>'; });

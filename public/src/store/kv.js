/* IndexedDB 键值存储（idb-keyval）：数据库 control-daguan / 表 kv；键 rec（学习记录）、gist（同步设置）。 */
import { track } from '../core/activity.js';
const idb = globalThis.idbKeyval;
const db = idb.createStore('control-daguan', 'kv');
export const kv = { get: k => idb.get(k, db), set: (k, v) => track(idb.set(k, v, db), 'indexeddb-write'), del: k => track(idb.del(k, db), 'indexeddb-delete'), keys: () => idb.keys(db) };

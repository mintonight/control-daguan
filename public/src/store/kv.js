/* IndexedDB 键值存储（idb-keyval）：数据库 control-daguan / 表 kv；键 rec（学习记录）、gist（同步设置）。 */
const idb = globalThis.idbKeyval;
const db = idb.createStore('control-daguan', 'kv');
export const kv = { get: k => idb.get(k, db), set: (k, v) => idb.set(k, v, db), del: k => idb.del(k, db), keys: () => idb.keys(db) };

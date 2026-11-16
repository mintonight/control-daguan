/* 题库（只读）：data/library.json 与按需加载的 data/questions/<id>.json。 */
export let lib = null;
export const byId = new Map();
export const details = new Map();

export async function loadLibrary() {
  const r = await fetch('data/library.json'); if (!r.ok) throw new Error(`library.json ${r.status}`);
  lib = await r.json(); lib.questions.forEach(q => byId.set(q.id, q));
  return lib;
}
/** 加载一题的答案与解析；已加载时直接返回 */
export async function loadDetail(id) {
  if (details.has(id)) return details.get(id);
  const r = await fetch(`data/questions/${id}.json`); if (!r.ok) throw new Error(`question ${id} ${r.status}`);
  const d = await r.json(); details.set(id, d); return d;
}

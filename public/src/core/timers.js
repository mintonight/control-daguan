/* 定时器的唯一入口（eslint 禁止在别处直接调用 setTimeout/clearTimeout）。 */
/** ms 毫秒后执行 fn；返回取消函数 */
export function after(ms, fn) {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
}
/** 防抖：最后一次调用 ms 毫秒后执行；.cancel() 取消，.pending() 是否有待执行的调用 */
export function debounce(fn, ms) {
  let cancel = null;
  const d = (...args) => { cancel?.(); cancel = after(ms, () => { cancel = null; fn(...args); }); };
  d.cancel = () => { cancel?.(); cancel = null; };
  d.pending = () => cancel !== null;
  return d;
}

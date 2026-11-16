// @ts-check
/* 定时器的唯一入口（eslint 禁止在别处直接调用 setTimeout/clearTimeout）。 */
import { activity } from './activity.js';
/** @typedef {{idle?: boolean}} TimerOptions */
/** ms 毫秒后执行 fn；取消只释放尚未触发的任务，不会提前释放已经运行的异步回调。
 * @param {number} ms @param {()=>unknown} fn @param {TimerOptions} [options] */
export function after(ms, fn, { idle = true } = {}) {
  const done = idle ? activity.begin('timer') : () => {};
  let scheduled = true;
  const t = setTimeout(() => {
    scheduled = false;
    try {
      const result = fn();
      if (result && typeof result === 'object' && 'then' in result) {
        // The timer owns its async callback: record rejection without creating an unhandled derived promise.
        Promise.resolve(result).then(() => done(), reason => done({ reason }));
      } else done();
    } catch (reason) { done({ reason }); throw reason; }
  }, ms);
  return () => { if (!scheduled) return; scheduled = false; clearTimeout(t); done(); };
}
/** 防抖：最后一次调用 ms 毫秒后执行；.cancel() 取消，.pending() 是否有待执行的调用
 * @template {unknown[]} A @param {(...args:A)=>unknown} fn @param {number} ms @param {TimerOptions} [options] */
export function debounce(fn, ms, options) {
  /** @type {null|(()=>void)} */
  let cancel = null;
  /** @param {A} args */
  const d = (...args) => { cancel?.(); cancel = after(ms, () => { cancel = null; return fn(...args); }, options); };
  d.cancel = () => { cancel?.(); cancel = null; };
  d.pending = () => cancel !== null;
  return d;
}

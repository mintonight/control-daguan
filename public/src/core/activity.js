// @ts-check
/** One ledger for finite application work. Observation never flushes or advances that work. */
export class Activity {
  /** @type {Set<symbol>} */
  pending = new Set();
  /** @type {unknown[]} */
  failures = [];
  /** @type {Set<()=>void>} */
  listeners = new Set();
  /** @type {Set<unknown[]>} */
  observers = new Set();
  version = 0;

  /** Register before starting work. Release exactly once, including cancellation.
   * @param {string} label @returns {(failure?: {reason: unknown})=>void} */
  begin(label) {
    if (!this.pending.size) this.failures = [];
    const token = Symbol(label); this.pending.add(token); this.changed();
    return failure => {
      if (!this.pending.delete(token)) return;
      if (failure) {
        this.failures.push(failure.reason);
        for (const errors of this.observers) errors.push(failure.reason);
      }
      this.changed();
    };
  }
  changed() { this.version++; for (const fn of [...this.listeners]) fn(); }
  /** Preserve the caller's resolved value/rejection. Register through its final continuation.
   * @template T @param {PromiseLike<T>} promise @param {string} [label] @returns {Promise<T>} */
  track(promise, label = 'promise') {
    const done = this.begin(label);
    return Promise.resolve(promise).then(value => { done(); return value; }, reason => { done({ reason }); throw reason; });
  }
  /** Observe a quiescent work epoch. Reject if any tracked work in that epoch failed.
   * Cancellation is successful settlement, not failure. Errors remain observable until new work starts.
   * The microtask checks include continuations which enqueue more work after a promise settles. */
  async idle() {
    const failures = [...this.failures];
    this.observers.add(failures);
    try {
      for (;;) {
        if (this.pending.size) await new Promise(resolve => {
          const changed = () => { this.listeners.delete(changed); resolve(undefined); };
          this.listeners.add(changed);
        });
        const version = this.version;
        await Promise.resolve(); await Promise.resolve();
        if (this.pending.size || this.version !== version) continue;
        if (failures.length) throw new AggregateError([...failures], 'Application work failed');
        return;
      }
    } finally { this.observers.delete(failures); }
  }
}

export const activity = new Activity();
/** @template T @param {PromiseLike<T>} promise @param {string} [label] */
export const track = (promise, label) => activity.track(promise, label);
export const idle = () => activity.idle();

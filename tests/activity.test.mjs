import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Activity, activity, idle } from '../public/src/core/activity.js';
import { after, debounce } from '../public/src/core/timers.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const microtasks = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('idle is observation: a held write blocks both observers and keeps its result', async () => {
  const ledger = new Activity(), write = deferred();
  const job = ledger.track(write.promise, 'write');
  let ready = 0;
  const a = ledger.idle().then(() => ready++), b = ledger.idle().then(() => ready++);
  const version = ledger.version;
  await microtasks(); assert.equal(ready, 0); assert.equal(ledger.version, version);
  write.resolve(42); assert.equal(await job, 42); await Promise.all([a, b]); assert.equal(ready, 2);
});
test('idle follows work scheduled by settlement continuations', async () => {
  const ledger = new Activity(), write = deferred(), sync = deferred();
  ledger.track(write.promise, 'write').then(() => ledger.track(sync.promise, 'sync'));
  let ready = false; const waiting = ledger.idle().then(() => ready = true);
  write.resolve(); await microtasks(); assert.equal(ready, false);
  sync.resolve(); await waiting; assert.equal(ready, true);
});
test('rejection propagates unchanged and idle reports it without consuming the failure; the next work epoch may recover', async () => {
  for (const reason of [new Error('write failed'), undefined]) {
    const ledger = new Activity();
    const job = ledger.track(Promise.reject(reason), 'write');
    await assert.rejects(job, e => e === reason);
    for (let i = 0; i < 2; i++) await assert.rejects(ledger.idle(), e => e instanceof AggregateError && e.errors[0] === reason);
    const release = ledger.begin('recovery'); release(); await ledger.idle();
  }
});
test('a recovery continuation cannot erase failure from an idle observer already waiting', async () => {
  const ledger = new Activity(), write = deferred(), reason = new Error('failed before recovery');
  const job = ledger.track(write.promise, 'write').catch(() => ledger.track(Promise.resolve('recovered'), 'recovery'));
  const waiting = assert.rejects(ledger.idle(), e => e instanceof AggregateError && e.errors.includes(reason));
  write.reject(reason); await job; await waiting;
  await ledger.idle();
});
test('cancellation is idempotent and settles pending timers without running callbacks', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let called = false; const cancel = after(100, () => called = true);
  const waiting = idle(); await microtasks(); assert.equal(activity.pending.size, 1);
  cancel(); cancel(); await waiting; t.mock.timers.tick(200); assert.equal(called, false);
});
test('a debounce replacement remains pending, does not flush on idle, and runs only the last call', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const hits = [], fn = debounce(value => hits.push(value), 100);
  fn('old'); fn('new'); let ready = false; const waiting = idle().then(() => ready = true);
  await microtasks(); assert.equal(ready, false); assert.deepEqual(hits, []);
  t.mock.timers.tick(99); await microtasks(); assert.equal(ready, false);
  t.mock.timers.tick(1); await waiting; assert.deepEqual(hits, ['new']);
  fn('cancelled'); fn.cancel(); await idle(); t.mock.timers.tick(100); assert.deepEqual(hits, ['new']);
});
test('cancelling a fired timer does not release its still-running async callback', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const work = deferred(); const cancel = after(10, () => work.promise);
  let ready = false; const waiting = idle().then(() => ready = true);
  t.mock.timers.tick(10); cancel(); await microtasks(); assert.equal(ready, false);
  work.resolve(); await waiting; assert.equal(ready, true);
});
test('async timer rejection settles the ledger and rejects idle instead of hanging', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const reason = new Error('async callback failed');
  after(10, () => Promise.reject(reason)); const waiting = idle();
  const rejected = assert.rejects(waiting, e => e instanceof AggregateError && e.errors.includes(reason));
  t.mock.timers.tick(10); await rejected;
  const recovered = activity.begin('recovery'); recovered(); await idle();
});
test('synchronous timer throws still surface normally and cannot strand idle', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const reason = new Error('sync callback failed'); after(10, () => { throw reason; });
  assert.throws(() => t.mock.timers.tick(10), e => e === reason);
  await assert.rejects(idle(), e => e instanceof AggregateError && e.errors.includes(reason));
  const recovered = activity.begin('recovery'); recovered(); await idle();
});
test('decorative timeout opt-out does not delay idle or change when the timeout fires', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let called = false; after(100, () => called = true, { idle: false });
  await idle(); assert.equal(called, false); t.mock.timers.tick(100); assert.equal(called, true);
});

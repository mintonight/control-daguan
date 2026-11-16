import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { GistSync, FILE } from '../../public/src/sync/gist.js';
import { canon, syncPart } from '../../public/src/core/merge.js';
import { normRec } from '../../public/src/core/record.js';
import { activity } from '../../public/src/core/activity.js';

export const empty = () => ({ favorites: [], marks: {}, srs: {}, updated: {}, notes: {}, history: [], retention: 0.9, retentionAt: 0 });
const copy = value => structuredClone(value);
export const projection = value => canon(syncPart(value));

export async function machine(clock) {
  const server = { rec: empty(), queue: [], reads: 0, writes: 0, failures: 0, httpFailures: 0, offlineFailures: 0, lostAcks: 0 };
  const devices = [];
  for (let index = 0; index < 2; index++) {
    const durable = new Map([['gist', { token: 'synthetic-test-token', gistId: 'shared' }]]);
    const device = { rec: normRec({ ...empty(), fontScale: index ? 115 : 85 }), errors: [], overlaps: 0 };
    device.persist = () => durable.set('rec', copy(device.rec));
    device.stored = () => copy(durable.get('rec'));
    device.sync = new GistSync({
      kv: { get: async key => copy(durable.get(key)), set: async (key, value) => { durable.set(key, copy(value)); }, del: async key => { durable.delete(key); } },
      getLocal: () => device.rec,
      applyMerged: async merged => { device.rec = normRec({ ...device.rec, ...copy(merged) }); device.persist(); },
      fetch: (url, init = {}) => new Promise((resolve, reject) => {
        assert.equal(url, 'https://api.github.com/gists/shared');
        server.queue.push({ method: init.method || 'GET', body: init.body, resolve, reject, device: index });
      }),
    });
    await device.sync.init();
    devices.push(device);
  }
  const real = {
    server, devices, editsWhileBusy: 0,
    async start(index) {
      const device = devices[index], previous = device.sync.busy;
      const promise = device.sync.sync();
      promise.catch(error => device.errors.push(error));
      if (previous) {
        assert.equal(promise, previous); assert.equal(device.sync.again, true); device.overlaps++;
      }
      await turn();
    },
    async deliver(index = 0, outcome = 'ok') {
      if (!server.queue.length) return;
      const [request] = server.queue.splice(index % server.queue.length, 1);
      if (outcome === 'offline') { server.failures++; server.offlineFailures++; request.reject(new TypeError('simulated connection loss')); }
      else if (outcome === 'http') { server.failures++; server.httpFailures++; request.resolve(new Response('', { status: 500 })); }
      else {
        if (request.method === 'PATCH') {
          const payload = JSON.parse(JSON.parse(request.body).files[FILE].content);
          assert.equal(payload.app, 'control-daguan'); assert.equal(payload.version, 3);
          server.rec = copy(payload); server.writes++;
        } else { assert.equal(request.method, 'GET'); server.reads++; }
        if (outcome === 'lostAck' && request.method === 'PATCH') {
          server.lostAcks++; request.reject(new TypeError('committed but response lost'));
        } else request.resolve(new Response(JSON.stringify({ files: { [FILE]: { content: JSON.stringify(copy(server.rec)) } } }), { status: 200 }));
      }
      await turn();
    },
    async advance(ms) { clock.tick(ms); await turn(); },
    async drain() {
      for (let step = 0; step < 300; step++) {
        if (server.queue.length) await real.deliver();
        else if (devices.some(d => d.sync.busy)) await turn();
        else if (activity.pending.size) await real.advance(3000);
        else return;
      }
      assert.fail('sync work failed to quiesce within the deterministic bound');
    },
    async agree() {
      await real.drain();
      // Gist has no compare-and-swap: final convergence assumes fair successful pulls by BOTH devices.
      for (let round = 0; round < 6; round++) {
        for (let index = 0; index < 2; index++) { await real.start(index); await real.drain(); }
        if (devices.every(d => projection(d.rec) === projection(server.rec))) return;
      }
      assert.fail('two devices and remote did not converge after fair successful synchronization');
    },
    async close() {
      for (const device of devices) device.sync.cancelScheduled?.();
      await real.drain();
      for (const device of devices) device.sync.cancelScheduled?.();
      assert.equal(activity.pending.size, 0);
    },
  };
  return real;
}

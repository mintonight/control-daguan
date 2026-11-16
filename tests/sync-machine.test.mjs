import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { machine, projection } from './helpers/sync-machine.mjs';

test('two devices with same-time retention edits converge instead of alternately overwriting the Gist', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const real = await machine(t.mock.timers);
  try {
    real.devices[0].rec.retention = 0.8; real.devices[0].rec.retentionAt = 42;
    real.devices[1].rec.retention = 0.95; real.devices[1].rec.retentionAt = 42;
    for (const device of real.devices) device.persist();
    await real.start(0); await real.start(1); await real.start(0);
    await real.agree();
    assert.equal(real.server.rec.retention, 0.95);
    assert.ok(real.devices[0].overlaps > 0);
  } finally { await real.close(); }
});

const cardAt = at => ({ due: new Date(at).toISOString(), last_review: new Date(at).toISOString(), reps: 1,
  stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, learning_steps: 0, lapses: 0, state: 2 });
const bundle = (record, id) => ({
  favorite: record.favorites.includes(+id), mark: record.marks[id] || null,
  card: record.srs[id]?.card || null, at: record.updated[id] || 0,
});
function edit(model, real, device, kind, id, value) {
  const at = ++model.time, rec = real.devices[device].rec;
  if (real.devices[device].sync.busy) real.editsWhileBusy++;
  if (kind === 'note') {
    const note = { text: value ? `device-${device}-note-${at}` : '', at };
    rec.notes[id] = { ...note }; model.notes[id] = note;
  } else if (kind === 'retention') {
    const retention = value ? 0.95 : 0.8;
    rec.retention = retention; rec.retentionAt = at;
    model.retention = retention; model.retentionAt = at;
  } else {
    const state = value ? 'mastered' : null;
    rec.favorites = rec.favorites.filter(q => q !== +id);
    if (value) rec.favorites.push(+id);
    if (state) {
      const iso = new Date(at).toISOString();
      const card = cardAt(at);
      const log = { id: `${id}-${at}`, review: iso, rating: 3, mark: 'mastered', state: 2, due: iso, stability: 1, difficulty: 5, scheduled_days: 1 };
      rec.marks[id] = { state, at };
      rec.srs[id] = { card, logs: [...(rec.srs[id]?.logs || []), log] };
      (model.logs[id] ||= []).push(log.id);
    } else { delete rec.marks[id]; delete rec.srs[id]; model.reset.add(id); }
    rec.updated[id] = at;
    const history = { id: +id, state, at };
    rec.history.push(history); model.history.push(history);
    // Independent model: the complete question bundle is one intentional LWW unit.
    model.questions[id] = { favorite: !!value, mark: state ? { state, at } : null,
      card: state ? cardAt(at) : null, at };
  }
  real.devices[device].persist();
  real.devices[device].sync.schedule();
}
function oracle(model, real) {
  for (const record of [...real.devices.map(d => d.rec), real.server.rec]) {
    for (const [id, expected] of Object.entries(model.questions)) assert.deepEqual(bundle(record, id), expected, `question ${id}`);
    for (const [id, expected] of Object.entries(model.notes)) assert.deepEqual(record.notes[id], expected, `note ${id}`);
    assert.equal(record.retention, model.retention); assert.equal(record.retentionAt, model.retentionAt);
    assert.deepEqual([...record.history].sort((a, b) => a.at - b.at), model.history);
    for (const [id, logs] of Object.entries(model.logs)) {
      // Reset removes a card and its attached logs. The format has no per-log tombstones.
      if (!model.reset.has(id) && record.srs[id]) assert.deepEqual(record.srs[id].logs.map(l => l.id).sort(), [...logs].sort());
    }
  }
  for (const device of real.devices) {
    assert.equal(projection(device.stored()), projection(device.rec));
    assert.equal(device.sync.busy, null); assert.equal(!!device.sync.again, false);
    assert.equal(device.sync.pending, false); assert.equal(device.sync.cfg.lastError, null);
  }
  assert.equal(real.devices[0].rec.fontScale, 85); assert.equal(real.devices[1].rec.fontScale, 115);
  assert.ok(real.devices.every(d => projection(d.rec) === projection(real.server.rec)));
}
const initialModel = () => ({ time: 100000, questions: {}, notes: {}, history: [], logs: {}, reset: new Set(), retention: 0.9, retentionAt: 0 });
const command = (label, run) => ({ check: () => true, run, toString: () => label });
const deviceArb = fc.integer({ min: 0, max: 1 });
const editArb = fc.tuple(deviceArb, fc.constantFrom('question', 'note', 'retention'), fc.constantFrom('1', '2', '3'), fc.boolean())
  .map(([d, kind, id, value]) => command(`edit(${d},${kind},${id},${value})`, async (model, real) => edit(model, real, d, kind, id, value)));
const startArb = deviceArb.map(d => command(`sync(${d})`, async (_model, real) => real.start(d)));
const deliveryArb = fc.tuple(fc.nat({ max: 5 }), fc.constantFrom('ok', 'ok', 'offline', 'http', 'lostAck'))
  .map(([index, outcome]) => command(`network(${index},${outcome})`, async (_model, real) => real.deliver(index, outcome)));
const clockArb = fc.constantFrom(499, 500, 3000).map(ms => command(`advance(${ms})`, async (_model, real) => real.advance(ms)));

for (const seed of [12012026, 13012026]) {
  test(`two-device sync state machine seed=${seed}: edits, busy/again, reordered failures and fair retry converge`, { timeout: 60000 }, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const stats = { overlaps: 0, busyEdits: 0, http: 0, offline: 0, lostAck: 0 };
    await fc.assert(fc.asyncProperty(fc.commands([editArb, startArb, deliveryArb, clockArb], { maxCommands: 50 }), async commands => {
      const real = await machine(t.mock.timers), model = initialModel();
      try {
        // Every run enters the actual busy/again branch, not merely a pure merge simulation.
        edit(model, real, 0, 'question', '1', true);
        edit(model, real, 1, 'note', '1', true);
        await real.start(0); await real.start(0); await real.start(1);
        await fc.asyncModelRun(() => ({ model, real }), commands);
        await real.agree(); oracle(model, real);
        assert.ok(real.devices[0].overlaps > 0);
        stats.busyEdits += real.editsWhileBusy;
        stats.overlaps += real.devices.reduce((n, d) => n + d.overlaps, 0);
        stats.http += real.server.httpFailures; stats.offline += real.server.offlineFailures; stats.lostAck += real.server.lostAcks;
      } finally { await real.close(); }
    }), { seed: +(process.env.SYNC_SEED || seed), numRuns: 100, ...(process.env.SYNC_PATH ? { path: process.env.SYNC_PATH } : {}) });
    t.diagnostic(JSON.stringify(stats));
    if (!process.env.SYNC_PATH) { assert.ok(stats.busyEdits > 0); assert.ok(stats.http > 0); assert.ok(stats.offline > 0); assert.ok(stats.lostAck > 0); }
  });
}

test('overlapping devices retain distinct fields, note/question tombstones and review logs after a lost PATCH response', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const real = await machine(t.mock.timers), model = initialModel();
  try {
    edit(model, real, 0, 'question', '1', true);
    edit(model, real, 1, 'question', '2', true);
    edit(model, real, 1, 'note', '1', true);
    await real.start(0); await real.start(1);
    await real.deliver(0); await real.deliver(0); // Both GET snapshots precede either PATCH.
    assert.equal(real.server.queue.filter(r => r.method === 'PATCH').length, 2);
    edit(model, real, 0, 'note', '3', true);
    await real.start(0); // An edit and explicit sync while the previous PATCH is still held.
    await real.deliver(0, 'lostAck'); await real.deliver(0);
    assert.equal(real.server.lostAcks, 1);
    assert.ok(real.devices[0].errors.some(error => error.kind === 'offline'));
    await real.agree(); oracle(model, real);
    edit(model, real, 0, 'note', '1', false);
    edit(model, real, 1, 'question', '2', false);
    edit(model, real, 0, 'question', '1', true);
    edit(model, real, 1, 'question', '1', true);
    await real.start(0); await real.start(0); await real.start(1);
    await real.agree(); oracle(model, real);
    assert.deepEqual(real.server.rec.notes['1'], model.notes['1']);
    assert.equal(real.server.rec.srs['2'], undefined);
    assert.ok(real.server.rec.updated['2'] > 0);
  } finally { await real.close(); }
});

test('quiescence without a later pull is not convergence: unconditional Gist PATCH has no CAS', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const real = await machine(t.mock.timers), model = initialModel();
  try {
    edit(model, real, 0, 'question', '1', true); edit(model, real, 1, 'note', '2', true);
    await real.start(0); await real.start(1);
    await real.deliver(); await real.deliver(); // Both read the old remote state.
    await real.drain();
    assert.notEqual(projection(real.devices[0].rec), projection(real.server.rec));
    await real.agree(); oracle(model, real);
  } finally { await real.close(); }
});

test('a future-dated note tombstone intentionally defeats an older-clock edit', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const real = await machine(t.mock.timers);
  try {
    real.devices[0].rec.notes['1'] = { text: '', at: 2000 };
    real.devices[1].rec.notes['1'] = { text: 'edited later on a slow clock', at: 1000 };
    for (const device of real.devices) device.persist();
    await real.agree();
    assert.deepEqual(real.server.rec.notes['1'], { text: '', at: 2000 });
  } finally { await real.close(); }
});

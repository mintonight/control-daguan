import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const base = 'https://example.test/control-daguan/';
const prefix = 'control-daguan:%2Fcontrol-daguan%2F:';
const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function platform() {
  const stores = new Map(), events = new Map();
  const key = req => typeof req === 'string' ? new URL(req, base).href : req.url || req.href;
  const faults = {put: false, missing: false};
  let network = async () => new Response('fresh');
  const caches = {
    has: async name => stores.has(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      const cache = {
        match: async req => data.get(key(req))?.clone(),
        delete: async req => data.delete(key(req)),
        keys: async () => [...data.keys()].map(url => new Request(url)),
        put: async (req, response) => { if (faults.put) throw new Error('QuotaExceededError'); data.set(key(req), response.clone()); },
        addAll: async requests => {
          const rows = await Promise.all(requests.map(async req => {
            const response = faults.missing ? new Response('', {status: 404}) : await network(req);
            if (!response.ok) throw new Error('missing shell asset');
            return [key(req), response];
          }));
          for (const [url, response] of rows) await cache.put(url, response);
        },
      };
      return cache;
    },
  };
  const context = vm.createContext({URL, Request, Response, Map, Promise, caches, fetch: req => network(req), self: {
    registration: {scope: base}, addEventListener: (name, fn) => events.set(name, fn), clients: {claim: async () => {}},
  }});
  vm.runInContext(source, context);
  return {caches, faults, events, run: code => vm.runInContext(code, context), network: fn => {network = fn;}};
}

test('worker acknowledges a download only after a readable cache write; quota errors propagate', async () => {
  const app = platform();
  app.faults.put = true;
  let lifetime, message;
  app.events.get('message')({data: {type:'CACHE_RUNTIME', url:'img/test.png'}, source: {url:base},
    ports:[{postMessage: value => {message = value;}}], waitUntil: promise => {lifetime = promise;}});
  await lifetime;
  assert.equal(message.ok, false);
  assert.match(message.error, /QuotaExceededError/);
  app.faults.put = false;
  await app.run("cacheRuntime('img/test.png')");
  assert.equal(await (await (await app.caches.open(prefix+'runtime')).match(base+'img/test.png')).text(), 'fresh');
  await assert.rejects(app.run("cacheRuntime('../other/img/test.png')"), /不是本应用/);
});

test('migration is repeatable, preserves foreign downloads and never overwrites a newer scoped copy', async () => {
  const app = platform();
  const legacy = await app.caches.open('cdg-runtime'), scoped = await app.caches.open(prefix+'runtime');
  await legacy.put(base+'img/old.png', new Response('old'));
  await legacy.put('https://example.test/mirror/img/foreign.png', new Response('foreign'));
  await scoped.put(base+'img/old.png', new Response('new'));
  await app.run('migrateRuntime()'); await app.run('migrateRuntime()');
  assert.equal(await (await scoped.match(base+'img/old.png')).text(), 'new');
  assert.equal((await legacy.keys()).length, 2);
  assert.equal((await scoped.keys()).length, 1);
});

test('failed shell recovery retains working files and a subsequent retry repairs all missing assets', async () => {
  const app = platform();
  const shellName = app.run('SHELL'), cache = await app.caches.open(shellName);
  await cache.put(base+'index.html', new Response('working entry'));
  app.faults.missing = true;
  await assert.rejects(app.run('repairShell()'), /missing shell asset/);
  assert.equal(await (await cache.match(base+'index.html')).text(), 'working entry');
  app.faults.missing = false;
  await app.run('repairShell()');
  assert.equal((await app.run('missingShell()')).length, 0);
});

test('cached runtime responses keep their background update alive until its cache write completes', async () => {
  const app = platform(), req = new Request(base+'img/test.png');
  await (await app.caches.open(prefix+'runtime')).put(req, new Response('cached'));
  let release, lifetime;
  app.network(() => new Promise(resolve => {release = resolve;}));
  app.run('globalThis.testRequest = new Request(self.registration.scope + "img/test.png")');
  app.run('globalThis.testEvent = {}');
  // Supply the platform lifetime observer, not a substitute implementation of the worker path.
  app.run('testEvent').waitUntil = promise => {lifetime = promise;};
  assert.equal(await (await app.run('staleWhileRevalidate(testRequest, testEvent)')).text(), 'cached');
  assert.ok(lifetime instanceof Promise);
  release(new Response('updated'));
  await lifetime;
  assert.equal(await (await (await app.caches.open(prefix+'runtime')).match(req)).text(), 'updated');
});

test('explicit cache clearing is scoped and cannot resurrect cleared legacy files on migration', async () => {
  const app = platform(), legacy = await app.caches.open('cdg-runtime');
  await legacy.put(base+'img/old.png', new Response('own'));
  await legacy.put('https://example.test/mirror/img/foreign.png', new Response('foreign'));
  await app.run('migrateRuntime()');
  await app.run('clearRuntime()');
  await app.run('migrateRuntime()');
  assert.equal(await legacy.match(base+'img/old.png'), undefined);
  assert.equal(await (await legacy.match('https://example.test/mirror/img/foreign.png')).text(), 'foreign');
  assert.equal((await (await app.caches.open(prefix+'runtime')).keys()).length, 0);
});

test('final download verification detects files lost after their individual successful writes', async () => {
  const app = platform();
  await app.run("cacheRuntime('img/one.png')");
  await app.run("cacheRuntime('img/two.png')");
  const cache = await app.caches.open(prefix+'runtime');
  await cache.delete(base+'img/one.png');
  const result = await app.run("verifyRuntime(['img/one.png','img/two.png'])");
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0], 'img/one.png');
});

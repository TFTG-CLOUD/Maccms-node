const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clearRuntimeCache,
  readThroughCache
} = require('../utils/runtimeCache');
const { MemoryCacheStore } = require('../services/SharedCacheStore');

test('readThroughCache reuses cached values before ttl expiry', async () => {
  let calls = 0;
  let now = 1000;
  const store = new MemoryCacheStore('runtime-test-1', { maxEntries: 10, cleanupIntervalMs: 60 * 1000, now: () => now });
  const loader = async () => {
    calls += 1;
    return { value: calls };
  };

  const first = await readThroughCache('nav', 5000, loader, { store });
  const second = await readThroughCache('nav', 5000, loader, { store });

  assert.deepEqual(first, { value: 1 });
  assert.deepEqual(second, { value: 1 });
  assert.equal(calls, 1);

  now = 7001;
  const third = await readThroughCache('nav', 5000, loader, { store });
  assert.deepEqual(third, { value: 2 });
  assert.equal(calls, 2);
});

test('clearRuntimeCache supports prefix invalidation', async () => {
  await clearRuntimeCache();

  let calls = 0;
  const loader = async () => {
    calls += 1;
    return calls;
  };

  await readThroughCache('front:nav', 5000, loader);
  await readThroughCache('front:home', 5000, loader);
  await clearRuntimeCache('front:');
  await readThroughCache('front:nav', 5000, loader);

  assert.equal(calls, 3);
});

test('memory runtime cache evicts least recently used items over maxEntries', async () => {
  let now = 1000;
  const store = new MemoryCacheStore('runtime-test-2', {
    maxEntries: 2,
    cleanupIntervalMs: 60 * 1000,
    now: () => now
  });

  await readThroughCache('a', 5000, async () => 1, { store });
  now += 1;
  await readThroughCache('b', 5000, async () => 2, { store });
  now += 1;
  await readThroughCache('a', 5000, async () => 99, { store });
  now += 1;
  await readThroughCache('c', 5000, async () => 3, { store });

  assert.equal(await store.get('a'), 1);
  assert.equal(await store.get('b'), null);
  assert.equal(await store.get('c'), 3);
});

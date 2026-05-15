const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clearRuntimeCache,
  readThroughCache
} = require('../utils/runtimeCache');

test('readThroughCache reuses cached values before ttl expiry', async () => {
  clearRuntimeCache();

  let calls = 0;
  let now = 1000;
  const nowProvider = () => now;
  const loader = async () => {
    calls += 1;
    return { value: calls };
  };

  const first = await readThroughCache('nav', 5000, loader, { now: nowProvider });
  const second = await readThroughCache('nav', 5000, loader, { now: nowProvider });

  assert.deepEqual(first, { value: 1 });
  assert.deepEqual(second, { value: 1 });
  assert.equal(calls, 1);

  now = 7001;
  const third = await readThroughCache('nav', 5000, loader, { now: nowProvider });
  assert.deepEqual(third, { value: 2 });
  assert.equal(calls, 2);
});

test('clearRuntimeCache supports prefix invalidation', async () => {
  clearRuntimeCache();

  let calls = 0;
  const loader = async () => {
    calls += 1;
    return calls;
  };

  await readThroughCache('front:nav', 5000, loader);
  await readThroughCache('front:home', 5000, loader);
  clearRuntimeCache('front:');
  await readThroughCache('front:nav', 5000, loader);

  assert.equal(calls, 3);
});

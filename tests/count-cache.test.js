const test = require('node:test');
const assert = require('node:assert/strict');

const { MemoryCacheStore } = require('../services/SharedCacheStore');
const { buildCountCacheKey, buildQueryCacheKey, readCountThroughCache, readQueryThroughCache } = require('../utils/countCache');

test('buildCountCacheKey is stable for equivalent filters', () => {
  const first = buildCountCacheKey('vod:type', {
    status: 1,
    type: { $in: [20, 24] },
    filterTokens: { $all: ['area:大陆', 'class:动作'] }
  });
  const second = buildCountCacheKey('vod:type', {
    filterTokens: { $all: ['area:大陆', 'class:动作'] },
    type: { $in: [20, 24] },
    status: 1
  });

  assert.equal(first, second);
});

test('readCountThroughCache reuses cached count values', async () => {
  const store = new MemoryCacheStore('count-cache-test', { maxEntries: 20, cleanupIntervalMs: 60 * 1000 });
  let calls = 0;
  const filter = { status: 1, type: { $in: [20, 24] } };

  const first = await readCountThroughCache('vod:type', filter, async () => {
    calls += 1;
    return 42;
  }, { ttlMs: 5000, store });

  const second = await readCountThroughCache('vod:type', { type: { $in: [20, 24] }, status: 1 }, async () => {
    calls += 1;
    return 99;
  }, { ttlMs: 5000, store });

  assert.equal(first, 42);
  assert.equal(second, 42);
  assert.equal(calls, 1);
});

test('buildQueryCacheKey is stable for equivalent payloads', () => {
  const first = buildQueryCacheKey('vod:show:list', {
    filter: { status: 1, type: { $in: [40] } },
    sortOptions: { hits: -1 },
    page: 1,
    pagesize: 24,
    fields: '_id name'
  });
  const second = buildQueryCacheKey('vod:show:list', {
    fields: '_id name',
    pagesize: 24,
    page: 1,
    sortOptions: { hits: -1 },
    filter: { type: { $in: [40] }, status: 1 }
  });

  assert.equal(first, second);
});

test('readQueryThroughCache reuses cached list values', async () => {
  const store = new MemoryCacheStore('query-cache-test', { maxEntries: 20, cleanupIntervalMs: 60 * 1000 });
  let calls = 0;
  const payload = {
    filter: { status: 1, type: { $in: [40] } },
    sortOptions: { hits: -1 },
    page: 1,
    pagesize: 24,
    fields: '_id name'
  };

  const first = await readQueryThroughCache('vod:show:list', payload, async () => {
    calls += 1;
    return [{ _id: 1, name: 'demo' }];
  }, { ttlMs: 5000, store });

  const second = await readQueryThroughCache('vod:show:list', {
    fields: '_id name',
    pagesize: 24,
    page: 1,
    sortOptions: { hits: -1 },
    filter: { type: { $in: [40] }, status: 1 }
  }, async () => {
    calls += 1;
    return [{ _id: 2, name: 'unexpected' }];
  }, { ttlMs: 5000, store });

  assert.deepEqual(first, [{ _id: 1, name: 'demo' }]);
  assert.deepEqual(second, [{ _id: 1, name: 'demo' }]);
  assert.equal(calls, 1);
});

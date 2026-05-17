const test = require('node:test');
const assert = require('node:assert/strict');

const { RedisCacheStore } = require('../services/SharedCacheStore');

function createRedisMock(overrides = {}) {
  return {
    getCalls: [],
    setCalls: [],
    zAddCalls: [],
    zRemCalls: [],
    zRangeCalls: [],
    zCardCalls: [],
    delCalls: [],
    unlinkCalls: [],
    multiCalls: 0,
    get: async function get(key) {
      this.getCalls.push(key);
      return Object.prototype.hasOwnProperty.call(overrides, 'getResult')
        ? overrides.getResult
        : null;
    },
    set: async function set(key, value, options) {
      this.setCalls.push({ key, value, options });
    },
    zAdd: async function zAdd(key, members) {
      this.zAddCalls.push({ key, members });
    },
    zRem: async function zRem(key, members) {
      this.zRemCalls.push({ key, members });
    },
    zRange: async function zRange(key, start, end) {
      this.zRangeCalls.push({ key, start, end });
      if (typeof overrides.zRange === 'function') {
        return overrides.zRange(key, start, end);
      }
      return [];
    },
    zCard: async function zCard(key) {
      this.zCardCalls.push(key);
      if (typeof overrides.zCard === 'function') {
        return overrides.zCard(key);
      }
      return 0;
    },
    del: async function del(keys) {
      this.delCalls.push(keys);
    },
    unlink: async function unlink(keys) {
      this.unlinkCalls.push(keys);
    },
    multi: function multi() {
      this.multiCalls += 1;
      return {
        exists() {
          return this;
        },
        exec: async () => []
      };
    }
  };
}

test('redis cache get does not update zset access order on cache hit', async () => {
  const client = createRedisMock({
    getResult: JSON.stringify({ value: 1 })
  });
  const store = new RedisCacheStore(client, 'shared-test', { maxEntries: 10, cleanupIntervalMs: 60 * 1000 });

  const result = await store.get('demo');

  assert.deepEqual(result, { value: 1 });
  assert.equal(client.getCalls.length, 1);
  assert.equal(client.zAddCalls.length, 0);
  assert.equal(client.zRemCalls.length, 0);
});

test('redis cache cleanupExpired only trims overflow members without full exists sweep', async () => {
  const client = createRedisMock({
    zCard: () => 5,
    zRange: () => ['a', 'b']
  });
  const store = new RedisCacheStore(client, 'shared-test', { maxEntries: 3, cleanupIntervalMs: 60 * 1000 });

  await store.cleanupExpired();

  assert.equal(client.multiCalls, 0);
  assert.equal(client.zCardCalls.length, 1);
  assert.equal(client.zRangeCalls.length, 1);
  assert.equal(client.zRemCalls.length, 1);
  assert.equal(client.unlinkCalls.length, 1);
});

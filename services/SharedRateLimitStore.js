const { getRedisClient } = require('./RedisClient');

class MemoryRateLimitStore {
  constructor(prefix = 'rate') {
    this.prefix = prefix;
    this.data = new Map();
  }

  buildKey(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key, ttlMs) {
    const storeKey = this.buildKey(key);
    const now = Date.now();
    const record = this.data.get(storeKey);

    if (!record || record.expiresAt <= now) {
      const next = { value: 1, expiresAt: now + ttlMs };
      this.data.set(storeKey, next);
      return 1;
    }

    record.value += 1;
    this.data.set(storeKey, record);
    return record.value;
  }

  async get(key) {
    const storeKey = this.buildKey(key);
    const now = Date.now();
    const record = this.data.get(storeKey);
    if (!record || record.expiresAt <= now) {
      this.data.delete(storeKey);
      return null;
    }
    return record.value;
  }

  async set(key, value, ttlMs) {
    this.data.set(this.buildKey(key), {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  async delete(key) {
    this.data.delete(this.buildKey(key));
  }
}

class RedisRateLimitStore {
  constructor(client, prefix = 'rate') {
    this.client = client;
    this.prefix = prefix;
  }

  buildKey(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key, ttlMs) {
    const storeKey = this.buildKey(key);
    await this.client.set(storeKey, '0', { PX: ttlMs, NX: true });
    const value = await this.client.incr(storeKey);
    const ttl = await this.client.pTTL(storeKey);
    if (ttl < 0) {
      await this.client.pExpire(storeKey, ttlMs);
    }
    return value;
  }

  async get(key) {
    const value = await this.client.get(this.buildKey(key));
    if (value === null || value === undefined) return null;
    return value;
  }

  async set(key, value, ttlMs) {
    await this.client.set(this.buildKey(key), String(value), { PX: ttlMs });
  }

  async delete(key) {
    await this.client.del(this.buildKey(key));
  }
}

let sharedStorePromise = null;

async function getSharedRateLimitStore() {
  if (!sharedStorePromise) {
    sharedStorePromise = (async () => {
      const client = await getRedisClient();
      if (client) return new RedisRateLimitStore(client, 'rate-limit');
      return new MemoryRateLimitStore('rate-limit');
    })();
  }
  return sharedStorePromise;
}

module.exports = {
  getSharedRateLimitStore,
  MemoryRateLimitStore
};

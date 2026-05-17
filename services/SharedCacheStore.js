const { getRedisClient } = require('./RedisClient');

function normalizeNow(nowProvider) {
  return typeof nowProvider === 'function' ? nowProvider() : Date.now();
}

class MemoryCacheStore {
  constructor(prefix, options = {}) {
    this.prefix = prefix;
    this.maxEntries = Math.max(1, Number(options.maxEntries || 500));
    this.cleanupIntervalMs = Math.max(1000, Number(options.cleanupIntervalMs || 60 * 1000));
    this.now = options.now;
    this.data = new Map();
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch(() => {});
    }, this.cleanupIntervalMs);
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  buildKey(key) {
    return `${this.prefix}:${key}`;
  }

  async get(key) {
    const storeKey = this.buildKey(key);
    const now = normalizeNow(this.now);
    const record = this.data.get(storeKey);
    if (!record) return null;
    if (record.expiresAt <= now) {
      this.data.delete(storeKey);
      return null;
    }
    record.accessedAt = now;
    this.data.set(storeKey, record);
    return record.value;
  }

  async set(key, value, ttlMs) {
    const storeKey = this.buildKey(key);
    const now = normalizeNow(this.now);
    this.data.set(storeKey, {
      value,
      expiresAt: now + ttlMs,
      accessedAt: now
    });
    this.trimToMaxEntries();
  }

  async delete(key) {
    this.data.delete(this.buildKey(key));
  }

  async deleteByPrefix(prefix = '') {
    const matchPrefix = this.buildKey(prefix);
    for (const key of this.data.keys()) {
      if (key.startsWith(matchPrefix)) {
        this.data.delete(key);
      }
    }
  }

  async clear() {
    this.data.clear();
  }

  async cleanupExpired() {
    const now = normalizeNow(this.now);
    for (const [key, record] of this.data.entries()) {
      if (record.expiresAt <= now) {
        this.data.delete(key);
      }
    }
    this.trimToMaxEntries();
  }

  trimToMaxEntries() {
    if (this.data.size <= this.maxEntries) return;
    const entries = Array.from(this.data.entries())
      .sort((a, b) => a[1].accessedAt - b[1].accessedAt);
    const overflow = entries.length - this.maxEntries;
    for (let index = 0; index < overflow; index += 1) {
      this.data.delete(entries[index][0]);
    }
  }
}

class RedisCacheStore {
  constructor(client, prefix, options = {}) {
    this.client = client;
    this.prefix = prefix;
    this.maxEntries = Math.max(1, Number(options.maxEntries || 500));
    this.cleanupIntervalMs = Math.max(1000, Number(options.cleanupIntervalMs || 60 * 1000));
    this.indexKey = `${this.prefix}:__index__`;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch(() => {});
    }, this.cleanupIntervalMs);
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  buildKey(key) {
    return `${this.prefix}:${key}`;
  }

  async get(key) {
    const storeKey = this.buildKey(key);
    const raw = await this.client.get(storeKey);
    if (raw === null || raw === undefined) {
      await this.client.zRem(this.indexKey, storeKey);
      return null;
    }
    await this.client.zAdd(this.indexKey, [{ score: Date.now(), value: storeKey }]);
    return JSON.parse(raw);
  }

  async set(key, value, ttlMs) {
    const storeKey = this.buildKey(key);
    await this.client.set(storeKey, JSON.stringify(value), { PX: ttlMs });
    await this.client.zAdd(this.indexKey, [{ score: Date.now(), value: storeKey }]);
    await this.trimToMaxEntries();
  }

  async delete(key) {
    const storeKey = this.buildKey(key);
    await Promise.all([
      this.client.del(storeKey),
      this.client.zRem(this.indexKey, storeKey)
    ]);
  }

  async deleteByPrefix(prefix = '') {
    const pattern = `${this.buildKey(prefix)}*`;
    const keys = await this.scanKeys(pattern);
    if (keys.length > 0) {
      await this.client.del(keys);
      await this.client.zRem(this.indexKey, keys);
    }
  }

  async clear() {
    const keys = await this.scanKeys(`${this.prefix}:*`);
    const filtered = keys.filter((key) => key !== this.indexKey);
    if (filtered.length > 0) {
      await this.client.del(filtered);
    }
    await this.client.del(this.indexKey);
  }

  async cleanupExpired() {
    const members = await this.client.zRange(this.indexKey, 0, -1);
    if (members.length === 0) return;
    const pipeline = this.client.multi();
    members.forEach((key) => pipeline.exists(key));
    const result = await pipeline.exec();
    const staleKeys = members.filter((key, index) => {
      const existsResult = result?.[index];
      return Array.isArray(existsResult) ? Number(existsResult[1]) === 0 : Number(existsResult) === 0;
    });
    if (staleKeys.length > 0) {
      await this.client.zRem(this.indexKey, staleKeys);
    }
    await this.trimToMaxEntries();
  }

  async trimToMaxEntries() {
    const size = await this.client.zCard(this.indexKey);
    if (size <= this.maxEntries) return;
    const overflow = size - this.maxEntries;
    const staleMembers = await this.client.zRange(this.indexKey, 0, overflow - 1);
    if (staleMembers.length === 0) return;
    await this.client.zRem(this.indexKey, staleMembers);
    await this.client.del(staleMembers);
  }

  async scanKeys(pattern) {
    const keys = [];
    let cursor = '0';
    do {
      const reply = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = Array.isArray(reply) ? reply[0] : reply.cursor;
      const batch = Array.isArray(reply) ? reply[1] : reply.keys;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }
}

const storePromises = new Map();

function getSharedCacheStore(prefix, options = {}) {
  const cacheKey = `${prefix}:${Number(options.maxEntries || 500)}:${Number(options.cleanupIntervalMs || 60 * 1000)}`;
  if (!storePromises.has(cacheKey)) {
    storePromises.set(cacheKey, (async () => {
      const client = await getRedisClient();
      if (client) return new RedisCacheStore(client, prefix, options);
      return new MemoryCacheStore(prefix, options);
    })());
  }
  return storePromises.get(cacheKey);
}

module.exports = {
  getSharedCacheStore,
  MemoryCacheStore
};

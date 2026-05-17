const { getSharedCacheStore } = require('../services/SharedCacheStore');

const RUNTIME_CACHE_MAX_ENTRIES = Math.max(1, Number(process.env.RUNTIME_CACHE_MAX_ENTRIES || 300));
const CACHE_CLEANUP_INTERVAL_MS = Math.max(1000, Number(process.env.CACHE_CLEANUP_INTERVAL_MS || 60 * 1000));
const pendingPromises = new Map();
const runtimeCacheStorePromise = getSharedCacheStore('runtime-cache', {
  maxEntries: RUNTIME_CACHE_MAX_ENTRIES,
  cleanupIntervalMs: CACHE_CLEANUP_INTERVAL_MS
});

async function readThroughCache(key, ttlMs, loader, options = {}) {
  const cacheStore = options.store
    ? options.store
    : await runtimeCacheStorePromise;
  const pending = pendingPromises.get(key);
  if (pending) {
    return pending;
  }

  const cached = await cacheStore.get(key);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  const nextPending = Promise.resolve()
    .then(loader)
    .then((value) => cacheStore.set(key, value, ttlMs).then(() => value))
    .finally(() => {
      const current = pendingPromises.get(key);
      if (current === nextPending) {
        pendingPromises.delete(key);
      }
    });

  pendingPromises.set(key, nextPending);
  return nextPending;
}

async function clearRuntimeCache(prefix = '') {
  for (const key of pendingPromises.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      pendingPromises.delete(key);
    }
  }

  const cacheStore = await runtimeCacheStorePromise;
  if (!prefix) {
    await cacheStore.clear();
    return;
  }

  await cacheStore.deleteByPrefix(prefix);
}

module.exports = {
  clearRuntimeCache,
  readThroughCache
};

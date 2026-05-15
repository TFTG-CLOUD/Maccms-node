const runtimeCache = new Map();

function normalizeNow(nowProvider) {
  return typeof nowProvider === 'function' ? nowProvider() : Date.now();
}

async function readThroughCache(key, ttlMs, loader, options = {}) {
  const now = normalizeNow(options.now);
  const cached = runtimeCache.get(key);

  if (cached) {
    if (cached.kind === 'value' && cached.expiresAt > now) {
      return cached.value;
    }
    if (cached.kind === 'promise') {
      return cached.promise;
    }
  }

  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      runtimeCache.set(key, {
        kind: 'value',
        value,
        expiresAt: normalizeNow(options.now) + ttlMs
      });
      return value;
    })
    .catch((error) => {
      const current = runtimeCache.get(key);
      if (current && current.kind === 'promise' && current.promise === pending) {
        runtimeCache.delete(key);
      }
      throw error;
    });

  runtimeCache.set(key, {
    kind: 'promise',
    promise: pending,
    expiresAt: now + ttlMs
  });

  return pending;
}

function clearRuntimeCache(prefix = '') {
  if (!prefix) {
    runtimeCache.clear();
    return;
  }

  for (const key of runtimeCache.keys()) {
    if (key.startsWith(prefix)) {
      runtimeCache.delete(key);
    }
  }
}

module.exports = {
  clearRuntimeCache,
  readThroughCache
};

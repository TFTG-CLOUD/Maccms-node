const crypto = require('node:crypto');

const { readThroughCache } = require('./runtimeCache');

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object' && !(value instanceof RegExp) && !(value instanceof Date)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  if (value instanceof RegExp) {
    return JSON.stringify({ $regex: value.source, $flags: value.flags });
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  return JSON.stringify(value);
}

function buildCountCacheKey(namespace, filter) {
  const digest = crypto.createHash('md5').update(stableStringify(filter || {})).digest('hex');
  return `count:${namespace}:${digest}`;
}

function buildQueryCacheKey(namespace, payload) {
  const digest = crypto.createHash('md5').update(stableStringify(payload || {})).digest('hex');
  return `query:${namespace}:${digest}`;
}

async function readCountThroughCache(namespace, filter, loader, options = {}) {
  const ttlMs = Math.max(1000, Number(options.ttlMs || process.env.VOD_COUNT_CACHE_TTL_MS || 30 * 1000));
  return readThroughCache(
    buildCountCacheKey(namespace, filter),
    ttlMs,
    loader,
    options
  );
}

async function readQueryThroughCache(namespace, payload, loader, options = {}) {
  const ttlMs = Math.max(1000, Number(options.ttlMs || 15 * 1000));
  return readThroughCache(
    buildQueryCacheKey(namespace, payload),
    ttlMs,
    loader,
    options
  );
}

module.exports = {
  buildCountCacheKey,
  buildQueryCacheKey,
  readCountThroughCache,
  readQueryThroughCache,
  stableStringify
};

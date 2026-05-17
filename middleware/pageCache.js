const { getSharedCacheStore } = require('../services/SharedCacheStore');

const PAGE_CACHE_TTL_MS = Math.max(1000, Number(process.env.PAGE_CACHE_TTL_MS || 60 * 60 * 1000));
const DETAIL_PAGE_CACHE_TTL_MS = Math.max(1000, Number(process.env.DETAIL_PAGE_CACHE_TTL_MS || 60 * 1000));
const PLAY_PAGE_CACHE_TTL_MS = Math.max(1000, Number(process.env.PLAY_PAGE_CACHE_TTL_MS || 60 * 1000));
const PAGE_CACHE_MAX_ENTRIES = Math.max(1, Number(process.env.PAGE_CACHE_MAX_ENTRIES || 500));
const CACHE_CLEANUP_INTERVAL_MS = Math.max(1000, Number(process.env.CACHE_CLEANUP_INTERVAL_MS || 60 * 1000));
const cacheStorePromise = getSharedCacheStore('page-cache', {
  maxEntries: PAGE_CACHE_MAX_ENTRIES,
  cleanupIntervalMs: CACHE_CLEANUP_INTERVAL_MS
});

function isPageCacheWhitelistedPath(path) {
  return (
    path === '/' ||
    path === '/index.php' ||
    /^\/index\.php\/?$/.test(path) ||
    /^\/(?:index\.php\/)?index\/index\/?$/.test(path) ||
    /^\/(?:index\.php\/)?vod\/(?:type|show)\/id\/[^/.?#]+(?:\/page\/\d+)?\.html$/.test(path) ||
    /^\/(?:index\.php\/)?vod\/detail\/id\/[^/.?#]+\.html$/.test(path)
  );
}

function getPageCacheTtlMs(path) {
  if (/^\/(?:index\.php\/)?vod\/detail\/id\/[^/.?#]+\.html$/.test(path)) {
    return DETAIL_PAGE_CACHE_TTL_MS;
  }
  return PAGE_CACHE_TTL_MS;
}

function buildVodPageCachePrefixes(vodId) {
  const ids = Array.isArray(vodId) ? vodId : [vodId];
  const prefixes = [];
  const seen = new Set();

  ids.forEach((item) => {
    const id = String(item || '').trim();
    if (!id) return;
    [
      `/vod/detail/id/${id}.html`,
      `/index.php/vod/detail/id/${id}.html`,
      `/vod/play/id/${id}/`,
      `/index.php/vod/play/id/${id}/`
    ].forEach((prefix) => {
      if (seen.has(prefix)) return;
      seen.add(prefix);
      prefixes.push(prefix);
    });
  });

  return prefixes;
}

function shouldBypassPageCache(req) {
  const path = req.path || req.originalUrl || '';
  if (req.method !== 'GET') return true;
  if (/^\/(?:admin|api|static|upload|js|css|images)(?:\/|$)/.test(path)) return true;
  if ((req.originalUrl || '').includes('?')) return true;
  if (!isPageCacheWhitelistedPath(path)) return true;
  return false;
}

async function pageCacheMiddleware(req, res, next) {
  if (shouldBypassPageCache(req)) return next();

  try {
    const cacheStore = await cacheStorePromise;
    const key = req.originalUrl;
    const cached = await cacheStore.get(key);
    if (typeof cached === 'string') {
      res.set('X-Cache', 'HIT');
      return res.send(cached);
    }
    res.set('X-Cache', 'MISS');

    const originalSend = res.send.bind(res);
    res.send = function(body) {
      if (res.statusCode === 200 && typeof body === 'string') {
        cacheStore.set(key, body, getPageCacheTtlMs(req.path || key)).catch((error) => {
          console.error('Page cache set error:', error.message);
        });
      }
      return originalSend(body);
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

async function clearCache(prefix = '') {
  const cacheStore = await cacheStorePromise;
  if (!prefix) {
    await cacheStore.clear();
    return;
  }
  await cacheStore.deleteByPrefix(prefix);
}

async function clearVodPageCaches(vodId) {
  const prefixes = buildVodPageCachePrefixes(vodId);
  if (prefixes.length === 0) return;
  await Promise.all(prefixes.map((prefix) => clearCache(prefix)));
}

module.exports = {
  buildVodPageCachePrefixes,
  clearCache,
  clearVodPageCaches,
  getPageCacheTtlMs,
  pageCacheMiddleware,
  shouldBypassPageCache
};

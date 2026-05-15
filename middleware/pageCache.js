const cache = new Map();

function shouldBypassPageCache(req) {
  const path = req.path || req.originalUrl || '';
  if (req.method !== 'GET') return true;
  if (/^\/(?:admin|api|static|upload|js|css|images)(?:\/|$)/.test(path)) return true;
  return false;
}

function pageCacheMiddleware(req, res, next) {
  if (shouldBypassPageCache(req)) return next();

  const key = req.originalUrl;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    res.set('X-Cache', 'HIT');
    return res.send(cached.body);
  }
  res.set('X-Cache', 'MISS');

  const originalSend = res.send.bind(res);
  res.send = function(body) {
    if (res.statusCode === 200 && typeof body === 'string') {
      cache.set(key, { body, expires: Date.now() + 3600000 });
    }
    return originalSend(body);
  };

  next();
}

function clearCache() {
  cache.clear();
}

module.exports = { pageCacheMiddleware, clearCache, shouldBypassPageCache };

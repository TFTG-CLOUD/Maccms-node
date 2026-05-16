function parseForwardedFor(value) {
  if (Array.isArray(value)) {
    return parseForwardedFor(value[0]);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getClientIp(req) {
  if (req.ip) return String(req.ip).trim();

  const forwardedChain = parseForwardedFor(req.headers['x-forwarded-for']);
  if (forwardedChain.length > 0) return forwardedChain[0];

  return String(req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown').trim() || 'unknown';
}

function createRateLimiter(options = {}) {
  const windowMs = Math.max(1000, Number(options.windowMs || 60 * 1000));
  const max = Math.max(1, Number(options.max || 60));
  const keyGenerator = typeof options.keyGenerator === 'function'
    ? options.keyGenerator
    : (req) => getClientIp(req);
  const message = options.message || '请求过于频繁，请稍后再试';
  const statusCode = Number(options.statusCode || 429);
  const store = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const key = String(keyGenerator(req) || 'unknown');
    const now = Date.now();
    const record = store.get(key);

    if (!record || record.expiresAt <= now) {
      store.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      if (req.accepts('json') && !req.accepts('html')) {
        return res.status(statusCode).json({ code: 0, msg: message });
      }
      return res.status(statusCode).render('error', { message, error: {} });
    }

    record.count += 1;
    store.set(key, record);
    return next();
  };
}

module.exports = {
  createRateLimiter,
  getClientIp
};

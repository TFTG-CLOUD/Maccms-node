const { getSharedRateLimitStore, MemoryRateLimitStore } = require('../services/SharedRateLimitStore');

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

function getClientIpGroup(req) {
  const ip = getClientIp(req);
  const ipv4 = ip.match(/(?:^|:)(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (ipv4) return `${ipv4[1]}.0/24`;

  const normalized = ip.replace(/^\[|\]$/g, '');
  if (normalized.includes(':')) {
    return normalized.split(':').slice(0, 4).join(':') + '::/64';
  }

  return ip;
}

function createRateLimiter(options = {}) {
  const windowMs = Math.max(1000, Number(options.windowMs || 60 * 1000));
  const max = Math.max(1, Number(options.max || 60));
  const keyGenerator = typeof options.keyGenerator === 'function'
    ? options.keyGenerator
    : (req) => getClientIp(req);
  const message = options.message || '请求过于频繁，请稍后再试';
  const banMessage = options.banMessage || message;
  const statusCode = Number(options.statusCode || 429);
  const banWindowMs = Math.max(0, Number(options.banWindowMs || 0));
  const banMax = Math.max(0, Number(options.banMax || 0));
  const banDurationMs = Math.max(0, Number(options.banDurationMs || 0));
  const storePromise = options.store
    ? Promise.resolve(options.store)
    : getSharedRateLimitStore();
  const shortStore = options.shortStore || new MemoryRateLimitStore('rate-limit-short');
  const longStore = options.longStore || new MemoryRateLimitStore('rate-limit-long');

  function sendBlocked(res, req, blockedMessage) {
    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(statusCode).json({ code: 0, msg: blockedMessage });
    }
    return res.status(statusCode).render('error', { message: blockedMessage, error: {} });
  }

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const key = String(keyGenerator(req) || 'unknown');
      const now = Date.now();
      const sharedStore = await storePromise;
      const shortCounterStore = sharedStore || shortStore;
      const longCounterStore = sharedStore || longStore;
      const shortWindowKey = `short:${key}`;
      const longWindowKey = `long:${key}`;
      const blockKey = `block:${key}`;

      const blockedUntilRaw = await longCounterStore.get(blockKey);
      const blockedUntil = Number(blockedUntilRaw || 0);
      if (blockedUntil > now) {
        return sendBlocked(res, req, banMessage);
      }
      if (blockedUntilRaw) {
        await longCounterStore.delete(blockKey);
      }

      if (banWindowMs > 0 && banMax > 0 && banDurationMs > 0) {
        const longCount = await longCounterStore.increment(longWindowKey, banWindowMs);
        if (longCount > banMax) {
          const banUntil = now + banDurationMs;
          await longCounterStore.set(blockKey, banUntil, banDurationMs);
          return sendBlocked(res, req, banMessage);
        }
      }

      const shortCount = await shortCounterStore.increment(shortWindowKey, windowMs);
      if (shortCount > max) {
        return sendBlocked(res, req, message);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createRateLimiter,
  getClientIp,
  getClientIpGroup
};

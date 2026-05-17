const { getClientIp } = require('./rateLimit');

const FRONT_ACCESS_LOG_ENABLED = process.env.FRONT_ACCESS_LOG !== 'false';

function formatDurationMs(startAtNs) {
  const elapsedNs = process.hrtime.bigint() - startAtNs;
  return `${Number(elapsedNs) / 1e6}ms`;
}

function frontAccessLogMiddleware(req, res, next) {
  if (!FRONT_ACCESS_LOG_ENABLED) {
    return next();
  }

  const startAtNs = process.hrtime.bigint();
  const ip = getClientIp(req);
  const route = req.originalUrl || req.url || req.path || '/';

  res.on('finish', () => {
    console.log(`[front] ${ip} ${route} ${res.statusCode} ${formatDurationMs(startAtNs)}`);
  });

  next();
}

module.exports = {
  frontAccessLogMiddleware
};

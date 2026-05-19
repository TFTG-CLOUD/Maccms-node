const Vod = require('../models/Vod');
const { buildMixedIdCandidates } = require('../utils/front');

const detailPathPatterns = [
  /^\/vod\/detail\/id\/([^/.?#]+)\.html$/,
  /^\/index\.php\/vod\/detail\/id\/([^/.?#]+)\.html$/
];

function resolveDetailVodId(path = '') {
  for (const pattern of detailPathPatterns) {
    const match = String(path || '').match(pattern);
    if (match) return match[1];
  }
  return '';
}

function frontCounterMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();

  const vodId = resolveDetailVodId(req.path || req.originalUrl || '');
  if (!vodId) return next();

  Vod.updateOne(
    { _id: { $in: buildMixedIdCandidates(vodId) } },
    { $inc: { hits: 1, hitsDay: 1, hitsWeek: 1, hitsMonth: 1 } },
    { timestamps: false }
  ).exec().catch((error) => {
    console.error('Detail hit counter update error:', error.message);
  });

  next();
}

module.exports = {
  frontCounterMiddleware,
  resolveDetailVodId
};

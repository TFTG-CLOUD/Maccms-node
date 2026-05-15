const Vod = require('../models/Vod');
const Art = require('../models/Art');

const SCOPE_FIELD_MAP = {
  day: 'hitsDay',
  week: 'hitsWeek',
  month: 'hitsMonth'
};

class HitStatsService {
  async resetScope(scope) {
    const normalizedScope = String(scope || '').trim();
    const field = SCOPE_FIELD_MAP[normalizedScope];
    if (!field) {
      throw new Error(`unsupported hit stats scope: ${normalizedScope}`);
    }

    const update = { $set: { [field]: 0 } };
    const [vodResult, artResult] = await Promise.all([
      Vod.updateMany({}, update),
      Art.updateMany({}, update)
    ]);

    return {
      scope: normalizedScope,
      vodModified: Number(vodResult?.modifiedCount || 0),
      artModified: Number(artResult?.modifiedCount || 0)
    };
  }
}

module.exports = new HitStatsService();

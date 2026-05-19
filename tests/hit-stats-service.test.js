const test = require('node:test');
const assert = require('node:assert/strict');

const Vod = require('../models/Vod');
const Art = require('../models/Art');
const hitStatsService = require('../services/HitStatsService');

test('resetScope clears day hit counters for vod and art', async () => {
  const originalVodUpdateMany = Vod.updateMany;
  const originalArtUpdateMany = Art.updateMany;
  const calls = [];

  Vod.updateMany = async (filter, update, options) => {
    calls.push({ model: 'vod', filter, update, options });
    return { acknowledged: true, modifiedCount: 3 };
  };
  Art.updateMany = async (filter, update, options) => {
    calls.push({ model: 'art', filter, update, options });
    return { acknowledged: true, modifiedCount: 2 };
  };

  try {
    const result = await hitStatsService.resetScope('day');
    assert.deepEqual(result, { scope: 'day', vodModified: 3, artModified: 2 });
  } finally {
    Vod.updateMany = originalVodUpdateMany;
    Art.updateMany = originalArtUpdateMany;
  }

  assert.deepEqual(calls, [
    { model: 'vod', filter: {}, update: { $set: { hitsDay: 0 } }, options: { timestamps: false } },
    { model: 'art', filter: {}, update: { $set: { hitsDay: 0 } }, options: { timestamps: false } }
  ]);
});

test('resetScope supports week and month counters', async () => {
  const originalVodUpdateMany = Vod.updateMany;
  const originalArtUpdateMany = Art.updateMany;
  const calls = [];

  Vod.updateMany = async (filter, update, options) => {
    calls.push({ model: 'vod', filter, update, options });
    return { acknowledged: true, modifiedCount: 1 };
  };
  Art.updateMany = async (filter, update, options) => {
    calls.push({ model: 'art', filter, update, options });
    return { acknowledged: true, modifiedCount: 1 };
  };

  try {
    await hitStatsService.resetScope('week');
    await hitStatsService.resetScope('month');
  } finally {
    Vod.updateMany = originalVodUpdateMany;
    Art.updateMany = originalArtUpdateMany;
  }

  assert.deepEqual(calls, [
    { model: 'vod', filter: {}, update: { $set: { hitsWeek: 0 } }, options: { timestamps: false } },
    { model: 'art', filter: {}, update: { $set: { hitsWeek: 0 } }, options: { timestamps: false } },
    { model: 'vod', filter: {}, update: { $set: { hitsMonth: 0 } }, options: { timestamps: false } },
    { model: 'art', filter: {}, update: { $set: { hitsMonth: 0 } }, options: { timestamps: false } }
  ]);
});

test('resetScope rejects unsupported scopes', async () => {
  await assert.rejects(
    () => hitStatsService.resetScope('year'),
    /unsupported hit stats scope/
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');

const Vod = require('../models/Vod');
const { resolveDetailVodId, frontCounterMiddleware } = require('../middleware/frontCounters');

test('resolveDetailVodId extracts ids from clean and pathinfo detail urls', () => {
  assert.equal(resolveDetailVodId('/vod/detail/id/123.html'), '123');
  assert.equal(resolveDetailVodId('/index.php/vod/detail/id/abc123.html'), 'abc123');
  assert.equal(resolveDetailVodId('/vod/play/id/1/sid/1/nid/1.html'), '');
});

test('frontCounterMiddleware increments vod hit stats without touching updatedAt timestamps', async () => {
  const originalUpdateOne = Vod.updateOne;
  let captured = null;

  Vod.updateOne = (filter, update, options) => {
    captured = { filter, update, options };
    return {
      exec: async () => ({ acknowledged: true, modifiedCount: 1 })
    };
  };

  try {
    await new Promise((resolve) => {
      frontCounterMiddleware(
        { method: 'GET', path: '/vod/detail/id/123.html', originalUrl: '/vod/detail/id/123.html' },
        {},
        resolve
      );
    });
  } finally {
    Vod.updateOne = originalUpdateOne;
  }

  assert.deepEqual(captured.update, { $inc: { hits: 1, hitsDay: 1, hitsWeek: 1, hitsMonth: 1 } });
  assert.deepEqual(captured.options, { timestamps: false });
});

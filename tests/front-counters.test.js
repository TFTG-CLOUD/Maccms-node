const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveDetailVodId } = require('../middleware/frontCounters');

test('resolveDetailVodId extracts ids from clean and pathinfo detail urls', () => {
  assert.equal(resolveDetailVodId('/vod/detail/id/123.html'), '123');
  assert.equal(resolveDetailVodId('/index.php/vod/detail/id/abc123.html'), 'abc123');
  assert.equal(resolveDetailVodId('/vod/play/id/1/sid/1/nid/1.html'), '');
});

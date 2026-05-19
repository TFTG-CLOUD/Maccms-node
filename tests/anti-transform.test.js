const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeCacheControl, antiTransformMiddleware } = require('../middleware/antiTransform');

test('mergeCacheControl appends no-transform without losing existing directives', () => {
  assert.equal(mergeCacheControl('', 'no-transform'), 'no-transform');
  assert.equal(mergeCacheControl('public, max-age=300', 'no-transform'), 'public, max-age=300, no-transform');
  assert.equal(mergeCacheControl('public, no-transform', 'no-transform'), 'public, no-transform');
});

test('antiTransformMiddleware sets anti-transform response headers', async () => {
  const headers = new Map();
  const req = {};
  const res = {
    get(name) {
      return headers.get(name);
    },
    set(name, value) {
      headers.set(name, value);
    }
  };

  let nextCalled = false;
  await antiTransformMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers.get('Cache-Control'), 'no-transform');
  assert.equal(headers.get('X-UA-Compatible'), 'IE=edge,chrome=1');
});

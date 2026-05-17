const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVodPageCachePrefixes,
  shouldBypassPageCache
} = require('../middleware/pageCache');

test('shouldBypassPageCache skips non-front or non-html-like requests', () => {
  assert.equal(shouldBypassPageCache({ method: 'POST', path: '/', originalUrl: '/' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/admin', originalUrl: '/admin' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/api/list', originalUrl: '/api/list' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/static/js/app.js', originalUrl: '/static/js/app.js' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/upload/vod/demo.jpg', originalUrl: '/upload/vod/demo.jpg' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/vod/search.html', originalUrl: '/vod/search.html?wd=test' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/vod/type/id/20.html', originalUrl: '/vod/type/id/20.html?page=2' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/vod/detail/id/1.html', originalUrl: '/vod/detail/id/1.html' }), false);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/vod/type/id/20.html', originalUrl: '/vod/type/id/20.html' }), false);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/vod/type/id/20/page/2.html', originalUrl: '/vod/type/id/20/page/2.html' }), false);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/vod/show/id/20.html', originalUrl: '/vod/show/id/20.html' }), false);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/index.php/vod/detail/id/1.html', originalUrl: '/index.php/vod/detail/id/1.html' }), false);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/vod/play/id/1/sid/1/nid/1.html', originalUrl: '/vod/play/id/1/sid/1/nid/1.html' }), true);
  assert.equal(shouldBypassPageCache({ method: 'GET', path: '/index.php/vod/play/id/1/sid/1/nid/1.html', originalUrl: '/index.php/vod/play/id/1/sid/1/nid/1.html' }), true);
});

test('buildVodPageCachePrefixes returns detail and play prefixes for both clean and pathinfo urls', () => {
  assert.deepEqual(buildVodPageCachePrefixes(123), [
    '/vod/detail/id/123.html',
    '/index.php/vod/detail/id/123.html',
    '/vod/play/id/123/',
    '/index.php/vod/play/id/123/'
  ]);
});

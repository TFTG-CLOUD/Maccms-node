const test = require('node:test');
const assert = require('node:assert/strict');

const {
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
});

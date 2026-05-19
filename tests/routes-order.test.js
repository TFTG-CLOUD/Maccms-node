const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const router = require('../routes');
const frontRouter = require('../routes/front');

test('admin and api routers are registered before the catch-all front router', () => {
  const patterns = router.stack.map((layer) => String(layer.regexp));
  const frontIndex = patterns.findIndex((pattern) => pattern === '/^\\/?(?=\\/|$)/i');
  const adminIndex = patterns.findIndex((pattern) => pattern === '/^\\/admin\\/?(?=\\/|$)/i');
  const apiIndex = patterns.findIndex((pattern) => pattern === '/^\\/api\\/?(?=\\/|$)/i');

  assert.ok(frontIndex >= 0, 'front router should exist');
  assert.ok(adminIndex >= 0, 'admin router should exist');
  assert.ok(apiIndex >= 0, 'api router should exist');
  assert.ok(adminIndex < frontIndex, 'admin router should be checked before front router');
  assert.ok(apiIndex < frontIndex, 'api router should be checked before front router');
});

test('front router supports legacy two-segment html routes without a trailing wildcard', () => {
  const patterns = frontRouter.stack.map((layer) => String(layer.regexp));
  assert.ok(
    patterns.includes('/^(?:\\/([^/]+?))(?:\\/([^/]+?))\\/?$/i'),
    'front router should match paths like /vod/search.html'
  );
});

test('front router registers explicit rss sitemap routes before generic dispatch', () => {
  const patterns = frontRouter.stack.map((layer) => String(layer.regexp));
  assert.ok(
    patterns.includes('/^\\/robots\\.txt\\/?$/i'),
    'front router should expose /robots.txt'
  );
  assert.ok(
    patterns.includes('/^\\/rss\\/index\\.xml\\/?$/i'),
    'front router should expose /rss/index.xml'
  );
  assert.ok(
    patterns.includes('/^\\/index\\.php\\/rss\\/index\\.xml\\/?$/i'),
    'front router should expose /index.php/rss/index.xml'
  );
});

test('clean-mode redirect middleware is registered before page cache middleware in app bootstrap', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const redirectIndex = appSource.indexOf("if (config.urlMode === 'clean') {");
  const pageCacheIndex = appSource.indexOf("if (config.pageCacheStatus) {");

  assert.ok(redirectIndex >= 0, 'clean redirect middleware block should exist');
  assert.ok(pageCacheIndex >= 0, 'page cache middleware block should exist');
  assert.ok(redirectIndex < pageCacheIndex, 'clean redirect middleware should run before page cache middleware');
});

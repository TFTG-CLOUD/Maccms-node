const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config');
const { macUrl, stripIndexPhp } = require('../utils/urlHelper');

test('macUrl keeps clean mode routes and skips static or external assets', () => {
  const previous = config.urlMode;
  config.urlMode = 'clean';
  try {
    assert.equal(macUrl('/vod/detail/id/123.html'), '/vod/detail/id/123.html');
    assert.equal(macUrl('/static/img/logo.png'), '/static/img/logo.png');
    assert.equal(macUrl('https://example.com/a.png'), 'https://example.com/a.png');
  } finally {
    config.urlMode = previous;
  }
});

test('macUrl prefixes pathinfo routes and stripIndexPhp removes the prefix safely', () => {
  const previous = config.urlMode;
  config.urlMode = 'pathinfo';
  try {
    assert.equal(macUrl('/vod/detail/id/123.html'), '/index.php/vod/detail/id/123.html');
    assert.equal(macUrl('/index.php/vod/detail/id/123.html'), '/index.php/vod/detail/id/123.html');
    assert.equal(macUrl('/upload/vod/demo.jpg'), '/upload/vod/demo.jpg');
    assert.equal(stripIndexPhp('/index.php/vod/detail/id/123.html'), '/vod/detail/id/123.html');
    assert.equal(stripIndexPhp('/index.php'), '/');
  } finally {
    config.urlMode = previous;
  }
});

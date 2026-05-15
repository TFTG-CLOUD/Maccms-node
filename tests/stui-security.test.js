const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('stui templates do not reference removed legacy or remote javascript assets', () => {
  const layout = read('views/stui/layout.pug');
  const play = read('views/stui/vod/play.pug');
  const detail = read('views/stui/vod/detail.pug');

  assert.equal(layout.includes('/static/js/home.js'), false);
  assert.equal(layout.includes('/static/js/jquery.autocomplete.js'), false);
  assert.equal(layout.includes('qrsearch()'), false);
  assert.equal(play.includes('https://cdn.jsdelivr.net/'), false);
  assert.equal(detail.includes('bdsharebuttonbox'), false);
});

test('stui block script does not call third-party share or short-url services', () => {
  const script = read('public/js/stui_block.js');

  assert.equal(script.includes('api.weibo.com/2/short_url/shorten.json'), false);
  assert.equal(script.includes('bdimg.share.baidu.com'), false);
  assert.equal(script.includes('share.baidu.com'), false);
  assert.equal(script.includes('baidushare'), false);
});

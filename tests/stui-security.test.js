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

test('stui layout includes anti-transform meta tags for mobile browsers', () => {
  const layout = read('views/stui/layout.pug');

  assert.equal(layout.includes('meta(name="applicable-device" content="pc,mobile")'), true);
  assert.equal(layout.includes('meta(name="MobileOptimized" content="width")'), true);
  assert.equal(layout.includes('meta(name="HandheldFriendly" content="true")'), true);
  assert.equal(layout.includes('meta(http-equiv="Cache-Control" content="no-transform")'), true);
  assert.equal(layout.includes('meta(http-equiv="Cache-Control" content="no-siteapp")'), true);
  assert.equal(layout.includes('meta(name="format-detection" content="telephone=no")'), true);
  assert.equal(layout.includes('meta(name="layoutmode" content="standard")'), true);
  assert.equal(layout.includes('meta(name="imagemode" content="force")'), true);
});

test('stui play template defers media element creation until client-side interaction', () => {
  const play = read('views/stui/vod/play.pug');

  assert.equal(play.includes('video#macVideo('), false);
  assert.equal(play.includes('iframe(src=playerSource ? playerSource.url : episode.url'), false);
  assert.equal(play.includes("document.createElement('video')"), true);
  assert.equal(play.includes("document.createElement('iframe')"), true);
  assert.equal(play.includes('data-player-url='), false);
  assert.equal(play.includes('data-player-payload='), true);
  assert.equal(play.includes('decodePlayerPayload'), true);
});

test('application serves legacy /img assets through an explicit static mount', () => {
  const appSource = read('app.js');

  assert.equal(appSource.includes("app.use('/img', express.static(path.join(__dirname, 'public', 'img')"), true);
});

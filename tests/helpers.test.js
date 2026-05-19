const test = require('node:test');
const assert = require('node:assert/strict');

const {
  seoReplace,
  stripHtml,
  sanitizePlainText,
  encodePlayerPayload,
  decodePlayerPayload
} = require('../utils/helpers');

test('seoReplace supports siteTitle placeholder for homepage seo', () => {
  const site = {
    siteTitle: '唐诡影视-唐朝诡事录,唐朝诡事录2免费观看,最新电影电视剧免费观看'
  };

  assert.equal(
    seoReplace('{siteTitle}', {}, site),
    '唐诡影视-唐朝诡事录,唐朝诡事录2免费观看,最新电影电视剧免费观看'
  );
});

test('seoReplace supports play-page placeholders and strips html content', () => {
  const site = {
    siteName: '唐诡影视',
    siteKeywords: '热门影视,高清播放'
  };

  assert.equal(
    seoReplace('{vod_name} {player_name} {episode_name} {siteKeywords}', {
      name: '唐朝诡事录',
      playerName: '量子线路',
      episodeName: '第374集',
      content: '<p>不会出现在这里</p>'
    }, site),
    '唐朝诡事录 量子线路 第374集 热门影视,高清播放'
  );
});

test('seoReplace supports type and search placeholders', () => {
  const site = {
    siteName: '唐诡影视'
  };

  assert.equal(
    seoReplace('{type_name} - {search_word} - {siteName}', {
      typeName: '动作片',
      searchWord: '成龙'
    }, site),
    '动作片 - 成龙 - 唐诡影视'
  );
});

test('stripHtml removes html tags and preserves readable text', () => {
  assert.equal(
    stripHtml('<p> 唐诡 <strong>影视</strong><br>更新 </p>'),
    '唐诡 影视 更新'
  );
});

test('sanitizePlainText trims wrapped html content for detail summary', () => {
  assert.equal(
    sanitizePlainText('  <div><p> 第一行 </p><p>第二行&nbsp;</p></div>  '),
    '第一行 第二行'
  );
});

test('encodePlayerPayload obscures player url payload and remains decodable', () => {
  const payload = {
    kind: 'video',
    url: 'https://cdn.example.com/demo/index.m3u8',
    mime: 'application/vnd.apple.mpegurl',
    hls: true
  };

  const encoded = encodePlayerPayload(payload);

  assert.equal(encoded.includes(payload.url), false);
  assert.deepEqual(decodePlayerPayload(encoded), payload);
});

test('player payload secret does not fall back to SESSION_SECRET', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const helpersSource = fs.readFileSync(path.join(__dirname, '..', 'utils', 'helpers.js'), 'utf8');

  assert.equal(helpersSource.includes('PLAYER_PAYLOAD_SECRET || process.env.SESSION_SECRET'), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config');

const {
  buildPlaylistSections,
  buildVodShowFilter,
  buildMixedIdCandidates,
  buildPlayerSource,
  buildVodRatingMeta,
  getVodLetterOptions,
  normalizePicUrl,
  splitFilterValues,
  buildVodShowPath,
  resolveTypeSelection,
  selectNavTypes
} = require('../utils/front');

test('normalizePicUrl supports remote and local image paths', () => {
  assert.equal(normalizePicUrl('https://img.example.com/poster.jpg'), 'https://img.example.com/poster.jpg');
  assert.equal(normalizePicUrl('//img.example.com/poster.jpg'), 'https://img.example.com/poster.jpg');
  assert.equal(normalizePicUrl('/upload/vod/demo.jpg'), '/upload/vod/demo.jpg');
  assert.equal(normalizePicUrl('upload/vod/demo.jpg'), '/upload/vod/demo.jpg');
  assert.equal(normalizePicUrl('static/img/logo.png'), '/static/img/logo.png');
  assert.equal(normalizePicUrl('/static/img/load.gif'), '/static/img/tanggui-qrcode.png');
  assert.equal(normalizePicUrl(''), '/static/img/tanggui-qrcode.png');
});

test('splitFilterValues decodes unicode escaped strings and removes duplicates', () => {
  assert.deepEqual(
    splitFilterValues('\\u5927\\u9646,\\u7f8e\\u56fd,\\u5927\\u9646'),
    ['大陆', '美国']
  );
});

test('buildVodShowPath keeps filter segments well-formed', () => {
  assert.equal(
    buildVodShowPath(20, { area: '中国大陆', year: 2025, by: 'hits', page: 2 }),
    '/vod/show/id/20/area/%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86/year/2025/by/hits/page/2.html'
  );
  assert.equal(buildVodShowPath(20, { area: '', by: 'time' }), '/vod/show/id/20/by/time.html');
});

test('buildVodShowPath adds /index.php prefix in pathinfo mode', () => {
  const previous = config.urlMode;
  config.urlMode = 'pathinfo';
  try {
    assert.equal(
      buildVodShowPath(20, { area: '大陆', by: 'time' }),
      '/index.php/vod/show/id/20/area/%E5%A4%A7%E9%99%86/by/time.html'
    );
  } finally {
    config.urlMode = previous;
  }
});

test('buildVodShowFilter supports legacy year strings, area aliases and digit letters', () => {
  const filter = buildVodShowFilter({
    id: 39,
    area: '大陆',
    year: '2025',
    letter: '0-9',
    class: '动作',
    lang: '国语'
  }, {
    currentType: { _id: 39 },
    filterTypeIds: [39, 40]
  }, {
    area: new Map([
      ['大陆', '大陆'],
      ['中国大陆', '大陆'],
      ['内地', '大陆']
    ]),
    class: new Map([
      ['动作', '动作']
    ]),
    lang: new Map([
      ['国语', '国语']
    ])
  });

  assert.equal(filter.status, 1);
  assert.deepEqual(filter.type, { $in: [39, 40] });
  assert.deepEqual(filter.filterTokens, {
    $all: ['area:大陆', 'year:2025', 'class:动作', 'lang:国语']
  });

  const digitLetterCondition = filter.$and.find((item) => item.letter instanceof RegExp);
  assert.equal(digitLetterCondition.letter.test('7'), true);
  assert.equal(digitLetterCondition.letter.test('A'), false);
});

test('getVodLetterOptions keeps 0-9 as one aggregated option', () => {
  assert.deepEqual(getVodLetterOptions().slice(-3), ['Y', 'Z', '0-9']);
  assert.equal(getVodLetterOptions().length, 27);
});

test('resolveTypeSelection merges numeric and objectId roots plus matching child aliases', () => {
  const types = [
    { _id: 20, name: '电影', pid: null, sort: 1 },
    { _id: 'oid-movie', name: '电影', pid: null, sort: 2 },
    { _id: 24, name: '动作片', pid: 20, sort: 1 },
    { _id: 'oid-action', name: '动作片', pid: 'oid-movie', sort: 2 },
    { _id: 'oid-comedy-root', name: '喜剧片', pid: null, sort: 99 }
  ];

  const resolved = resolveTypeSelection(types, 20);

  assert.equal(resolved.currentType.name, '电影');
  assert.deepEqual(resolved.subTypes.map((item) => item.name), ['动作片']);
  assert.deepEqual(
    resolved.filterTypeIds.map(String).sort(),
    ['20', '24', 'oid-action', 'oid-movie'].sort()
  );
});

test('resolveTypeSelection lets child pages reuse sibling filters from parent tree', () => {
  const types = [
    { _id: 21, name: '连续剧', pid: null, sort: 1, extend: { area: '\\u5927\\u9646,\\u97e9\\u56fd' } },
    { _id: 44, name: '国产剧', pid: 21, sort: 1 },
    { _id: 46, name: '韩国剧', pid: 21, sort: 2 },
    { _id: 'oid-cn-tv', name: '国产剧', pid: null, sort: 9 },
    { _id: 'oid-kr-tv', name: '韩国剧', pid: null, sort: 10 }
  ];

  const resolved = resolveTypeSelection(types, 'oid-cn-tv');

  assert.deepEqual(resolved.subTypes.map((item) => item.name), ['国产剧', '韩国剧']);
  assert.deepEqual(resolved.filterOptions.areas, ['大陆', '韩国']);
  assert.deepEqual(
    resolved.filterTypeIds.map(String).sort(),
    ['44', 'oid-cn-tv'].sort()
  );
});

test('selectNavTypes returns all parent categories sorted by sort', () => {
  const types = [
    { _id: 20, name: '电影', pid: null, sort: 1 },
    { _id: 'dup-movie', name: '电影', pid: null, sort: 2 },
    { _id: 21, name: '连续剧', pid: null, sort: 2 },
    { _id: 22, name: '综艺', pid: null, sort: 3 },
    { _id: 23, name: '动漫', pid: null, sort: 4 },
    { _id: 'cn-tv', name: '国产剧', pid: null, sort: 5 }
  ];

  assert.deepEqual(selectNavTypes(types).map((item) => item.name), ['电影', '连续剧', '综艺', '动漫', '国产剧']);
  assert.equal(selectNavTypes(types)[0]._id, 20);
});

test('buildMixedIdCandidates supports numeric and ObjectId forms', () => {
  const numericCandidates = buildMixedIdCandidates('7940');
  assert.equal(numericCandidates.length, 2);
  assert.equal(String(numericCandidates[0]), '7940');
  assert.equal(String(numericCandidates[1]), '7940');
  assert.equal(typeof numericCandidates[0], 'string');
  assert.equal(typeof numericCandidates[1], 'number');

  const objectIdCandidates = buildMixedIdCandidates('6a0697c6fb1bd768da9d90cc');
  assert.equal(objectIdCandidates.length, 2);
  assert.equal(String(objectIdCandidates[0]), '6a0697c6fb1bd768da9d90cc');
  assert.equal(String(objectIdCandidates[1]), '6a0697c6fb1bd768da9d90cc');
  assert.equal(typeof objectIdCandidates[0], 'string');
  assert.equal(objectIdCandidates[1].constructor.name, 'ObjectId');
});

test('buildPlayerSource detects hls, native video and iframe fallbacks', () => {
  assert.deepEqual(
    buildPlayerSource('https://cdn.example.com/stream/index.m3u8'),
    {
      url: 'https://cdn.example.com/stream/index.m3u8',
      kind: 'hls',
      mimeType: 'application/vnd.apple.mpegurl',
      useVideo: true
    }
  );

  assert.deepEqual(
    buildPlayerSource('https://cdn.example.com/video/demo.mp4?sign=1'),
    {
      url: 'https://cdn.example.com/video/demo.mp4?sign=1',
      kind: 'video',
      mimeType: 'video/mp4',
      useVideo: true
    }
  );

  assert.deepEqual(
    buildPlayerSource('https://example.com/player?id=1'),
    {
      url: 'https://example.com/player?id=1',
      kind: 'iframe',
      mimeType: '',
      useVideo: false
    }
  );
});

test('buildPlaylistSections precomputes source and episode presentation state', () => {
  const sections = buildPlaylistSections({
    _id: 321,
    playUrls: [
      {
        server: '线路A',
        episodes: [{ nid: 1, name: '第1集' }, { nid: 2, name: '' }]
      },
      {
        server: '',
        episodes: [{ nid: 3, name: '终章' }]
      }
    ]
  }, { activeSid: 1, activeNid: 2 });

  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0], {
    accordionId: 'playlist_1',
    index: 1,
    title: '播放线路 1',
    rawName: '线路A',
    countText: '2 个地址',
    isOpen: true,
    isActiveSource: true,
    episodes: [
      {
        nid: 1,
        label: '第1集',
        href: '/vod/play/id/321/sid/1/nid/1.html',
        isActive: false
      },
      {
        nid: 2,
        label: '第2集',
        href: '/vod/play/id/321/sid/1/nid/2.html',
        isActive: true
      }
    ]
  });
  assert.equal(sections[1].isOpen, false);
  assert.equal(sections[1].rawName, '');
  assert.equal(sections[1].episodes[0].href, '/vod/play/id/321/sid/2/nid/3.html');
});

test('buildVodRatingMeta formats douban and site scores for detail views', () => {
  assert.deepEqual(
    buildVodRatingMeta({ doubanScore: '7.65', doubanId: '1291546', score: 8.08 }),
    {
      doubanScore: '7.7',
      doubanId: '1291546',
      doubanUrl: 'https://movie.douban.com/subject/1291546/',
      siteScore: '8.1'
    }
  );

  assert.deepEqual(
    buildVodRatingMeta({ doubanScore: 0, doubanId: '', score: 0 }),
    {
      doubanScore: '',
      doubanId: '',
      doubanUrl: '',
      siteScore: ''
    }
  );
});

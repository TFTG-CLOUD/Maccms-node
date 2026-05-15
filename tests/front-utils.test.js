const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config');

const {
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
  });

  assert.equal(filter.status, 1);
  assert.deepEqual(filter.type, { $in: [39, 40] });
  assert.equal(filter.$and.length, 5);

  const yearCondition = filter.$and.find((item) => item.$or?.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'year')));
  assert.deepEqual(yearCondition, {
    $or: [
      { year: '2025' },
      { year: 2025 }
    ]
  });

  const areaCondition = filter.$and.find((item) => item.$or?.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'area')));
  const exactAreaValues = areaCondition.$or[0].area.$in;
  const areaRegex = areaCondition.$or[1].area;
  assert.deepEqual(exactAreaValues, ['大陆', '中国大陆']);
  assert.equal(areaRegex.test('中国大陆,中国香港'), true);
  assert.equal(areaRegex.test('美国'), false);

  const digitLetterCondition = filter.$and.find((item) => item.letter instanceof RegExp);
  assert.equal(digitLetterCondition.letter.test('7'), true);
  assert.equal(digitLetterCondition.letter.test('A'), false);

  const classCondition = filter.$and.find((item) => item.$or?.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'class')));
  const classRegex = classCondition.$or[1].class;
  assert.equal(classRegex.test('动作,喜剧'), true);
  assert.equal(classRegex.test('动作片在线播放'), false);

  const langCondition = filter.$and.find((item) => item.$or?.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'lang')));
  const langRegex = langCondition.$or[1].lang;
  assert.equal(langRegex.test('国语,中文字幕'), true);
  assert.equal(langRegex.test('英语'), false);
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

test('selectNavTypes keeps only canonical first-level categories', () => {
  const types = [
    { _id: 20, name: '电影', pid: null, sort: 1 },
    { _id: 'dup-movie', name: '电影', pid: null, sort: 2 },
    { _id: 21, name: '连续剧', pid: null, sort: 2 },
    { _id: 22, name: '综艺', pid: null, sort: 3 },
    { _id: 23, name: '动漫', pid: null, sort: 4 },
    { _id: 'cn-tv', name: '国产剧', pid: null, sort: 5 }
  ];

  assert.deepEqual(selectNavTypes(types).map((item) => item.name), ['电影', '连续剧', '综艺', '动漫']);
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

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Readable } = require('node:stream');

const {
  DEFAULT_POSTER_PATH,
  ensureVodPicture,
  ensureVodDocumentId,
  mergePlayUrls,
  hasVodChanges,
  buildCollectRunOptions,
  buildCollectUrlHash,
  downloadImageWithRetry,
  normalizeCollectRange,
  normalizeTopLevelJsonTypes
} = require('../services/CollectEngine');

test('normalizeCollectRange supports 1day 2day today week month all', () => {
  assert.deepEqual(normalizeCollectRange('today'), { key: 'today', hours: 24 });
  assert.deepEqual(normalizeCollectRange('1day'), { key: '1day', hours: 24 });
  assert.deepEqual(normalizeCollectRange('2day'), { key: '2day', hours: 48 });
  assert.deepEqual(normalizeCollectRange('week'), { key: 'week', hours: 168 });
  assert.deepEqual(normalizeCollectRange('month'), { key: 'month', hours: 720 });
  assert.deepEqual(normalizeCollectRange('all'), { key: 'all', hours: 0 });
  assert.deepEqual(normalizeCollectRange('unknown'), { key: 'today', hours: 24 });
});

test('buildCollectRunOptions converts manual action into normalized run options', () => {
  assert.deepEqual(buildCollectRunOptions({ range: '2day' }), { type: '2day' });
  assert.deepEqual(buildCollectRunOptions({ type: 'week' }), { type: 'week' });
  assert.deepEqual(buildCollectRunOptions({}), { type: 'today' });
});

test('buildCollectUrlHash prefers douban id when present', () => {
  const withDouban = buildCollectUrlHash({
    vod_douban_id: '30421581',
    vod_name: '帮我找房子吧',
    type_id: '22'
  });
  const sameDoubanDifferentName = buildCollectUrlHash({
    vod_douban_id: '30421581',
    vod_name: '别名',
    type_id: '99'
  });

  assert.equal(withDouban, sameDoubanDifferentName);
});

test('mergePlayUrls appends new server and deduplicates episodes on existing server', () => {
  const merged = mergePlayUrls(
    [
      {
        server: 'wjm3u8',
        episodes: [
          { nid: 1, name: '第01集', url: 'https://a.com/1.m3u8' },
          { nid: 2, name: '第02集', url: 'https://a.com/2.m3u8' }
        ]
      }
    ],
    [
      {
        server: 'wjm3u8',
        episodes: [
          { nid: 1, name: '第01集', url: 'https://a.com/1.m3u8' },
          { nid: 3, name: '第03集', url: 'https://a.com/3.m3u8' }
        ]
      },
      {
        server: 'qq',
        episodes: [
          { nid: 1, name: '正片', url: 'https://b.com/play' }
        ]
      }
    ]
  );

  assert.deepEqual(merged, [
    {
      server: 'wjm3u8',
      episodes: [
        { nid: 1, name: '第01集', url: 'https://a.com/1.m3u8' },
        { nid: 2, name: '第02集', url: 'https://a.com/2.m3u8' },
        { nid: 3, name: '第03集', url: 'https://a.com/3.m3u8' }
      ]
    },
    {
      server: 'qq',
      episodes: [
        { nid: 1, name: '正片', url: 'https://b.com/play' }
      ]
    }
  ]);
});

test('hasVodChanges returns false when the merged vod payload is effectively unchanged', () => {
  const existingVod = {
    name: '测试影片',
    type: 44,
    actor: '演员A',
    director: '导演A',
    writer: '',
    pic: '/upload/vod/demo.jpg',
    content: '剧情简介',
    playUrls: [
      {
        server: 'wjm3u8',
        episodes: [
          { nid: 1, name: '第01集', url: 'https://a.com/1.m3u8' }
        ]
      }
    ],
    downUrls: [],
    year: 2025,
    area: '中国大陆',
    lang: '',
    class: '剧情',
    tags: ['剧情'],
    total: 1,
    serial: '1',
    isEnd: true,
    score: 8.2,
    doubanScore: 7.8,
    doubanId: 'db-1',
    duration: '',
    publishDate: new Date('2026-05-16T00:00:00.000Z'),
    note: '',
    remarks: '更新至1集',
    letter: 'C',
    status: 1,
    hits: 10,
    hitsDay: 1,
    hitsWeek: 2,
    hitsMonth: 3
  };

  const nextVod = {
    ...existingVod,
    type: '44',
    playUrls: [
      {
        server: 'wjm3u8',
        episodes: [
          { nid: 99, name: '第01集', url: 'https://a.com/1.m3u8' }
        ]
      }
    ]
  };

  assert.equal(hasVodChanges(existingVod, nextVod), false);
});

test('normalizeTopLevelJsonTypes supports keyed object payloads from collect sources', () => {
  const types = normalizeTopLevelJsonTypes({
    1: '电影',
    2: '连续剧',
    3: '综艺'
  });

  assert.deepEqual(types, [
    { type_id: '1', type_name: '电影' },
    { type_id: '2', type_name: '连续剧' },
    { type_id: '3', type_name: '综艺' }
  ]);
});

test('ensureVodDocumentId assigns a generated _id for newly created vod docs', () => {
  const vodData = ensureVodDocumentId({ name: '测试影片' });

  assert.equal(typeof vodData._id?.toString(), 'string');
  assert.equal(vodData.name, '测试影片');

  const existing = ensureVodDocumentId({ _id: 123, name: '已有ID影片' });
  assert.equal(existing._id, 123);
});

test('ensureVodPicture falls back to the default poster when picture is missing', () => {
  assert.equal(DEFAULT_POSTER_PATH, '/static/img/no-poster.webp');
  assert.equal(ensureVodPicture(''), DEFAULT_POSTER_PATH);
  assert.equal(ensureVodPicture(null), DEFAULT_POSTER_PATH);
  assert.equal(ensureVodPicture('/upload/vod/demo.jpg'), '/upload/vod/demo.jpg');
});

test('downloadImageWithRetry returns CDN url when CDN upload is enabled', async (t) => {
  const originalKey = process.env.CDN_UPLOAD_API_KEY;
  const originalSecret = process.env.CDN_UPLOAD_API_SECRET;
  const originalBaseUrl = process.env.CDN_UPLOAD_BASE_URL;
  const originalFetch = globalThis.fetch;
  const originalFormData = globalThis.FormData;
  const originalHttpGet = http.get;

  process.env.CDN_UPLOAD_API_KEY = 'demo-key';
  process.env.CDN_UPLOAD_API_SECRET = 'demo-secret';
  process.env.CDN_UPLOAD_BASE_URL = 'https://cdn.example.com';

  class MockFormData {
    constructor() {
      this.entries = [];
    }

    set(name, value, filename) {
      this.entries.push({ name, value, filename });
    }
  }

  globalThis.FormData = MockFormData;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/upload/generate-signed-url')) {
      return {
        ok: true,
        json: async () => ({ uploadUrl: '/api/upload/direct/poster' })
      };
    }
    return {
      ok: true,
      json: async () => ({
        url: 'https://cdn.example.com/internal/poster.jpg',
        publicUrl: 'https://img.example.com/poster.jpg'
      })
    };
  };

  http.get = (url, options, callback) => {
    const res = new Readable({
      read() {
        this.push(Buffer.from('fake-image-content'));
        this.push(null);
      }
    });
    res.statusCode = 200;
    res.headers = { 'content-type': 'image/jpeg' };
    callback(res);
    return {
      on(eventName) {
        if (eventName === 'timeout') {
          return this;
        }
        return this;
      }
    };
  };

  t.after(async () => {
    process.env.CDN_UPLOAD_API_KEY = originalKey;
    process.env.CDN_UPLOAD_API_SECRET = originalSecret;
    process.env.CDN_UPLOAD_BASE_URL = originalBaseUrl;
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalFormData;
    http.get = originalHttpGet;
  });

  const result = await downloadImageWithRetry('http://example.com/poster.jpg');

  assert.equal(result.path, 'https://img.example.com/poster.jpg');
  assert.equal(result.usedFallback, false);
});

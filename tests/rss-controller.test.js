const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config');
const Vod = require('../models/Vod');
const Type = require('../models/Type');
const RssController = require('../controllers/front/RssController');

function createResponseCollector() {
  return {
    headers: {},
    statusCode: 200,
    body: '',
    set(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    type(value) {
      this.headers['content-type'] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('rss controller returns sitemap-style xml with clean-mode detail urls', async (t) => {
  const originalVodFind = Vod.find.bind(Vod);
  const originalTypeFind = Type.find.bind(Type);
  const previousSiteUrl = config.siteUrl;
  const previousUrlMode = config.urlMode;

  t.after(() => {
    Vod.find = originalVodFind;
    Type.find = originalTypeFind;
    config.siteUrl = previousSiteUrl;
    config.urlMode = previousUrlMode;
  });

  config.siteUrl = 'https://tanggui.cc';
  config.urlMode = 'clean';

  Vod.find = () => ({
    sort() { return this; },
    limit() { return this; },
    lean: async () => ([
      {
        _id: 123,
        updatedAt: new Date('2026-05-16T08:00:00.000Z')
      }
    ])
  });
  Type.find = () => ({
    sort() { return this; },
    lean: async () => ([
      { _id: 20, updatedAt: new Date('2026-05-15T08:00:00.000Z') }
    ])
  });

  const controller = new RssController();
  const res = createResponseCollector();

  await controller.index({}, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /xml/i);
  assert.match(res.body, /<urlset[^>]+sitemaps\.org/);
  assert.match(res.body, /<loc>https:\/\/tanggui\.cc\/vod\/detail\/id\/123\.html<\/loc>/);
  assert.match(res.body, /<loc>https:\/\/tanggui\.cc\/vod\/show\/id\/20\.html<\/loc>/);
});

test('rss controller prefixes detail urls in pathinfo mode', async (t) => {
  const originalVodFind = Vod.find.bind(Vod);
  const originalTypeFind = Type.find.bind(Type);
  const previousSiteUrl = config.siteUrl;
  const previousUrlMode = config.urlMode;

  t.after(() => {
    Vod.find = originalVodFind;
    Type.find = originalTypeFind;
    config.siteUrl = previousSiteUrl;
    config.urlMode = previousUrlMode;
  });

  config.siteUrl = 'https://tanggui.cc';
  config.urlMode = 'pathinfo';

  Vod.find = () => ({
    sort() { return this; },
    limit() { return this; },
    lean: async () => ([{ _id: 456, updatedAt: new Date('2026-05-16T08:00:00.000Z') }])
  });
  Type.find = () => ({
    sort() { return this; },
    lean: async () => ([])
  });

  const controller = new RssController();
  const res = createResponseCollector();

  await controller.index({}, res);

  assert.match(res.body, /<loc>https:\/\/tanggui\.cc\/index\.php\/vod\/detail\/id\/456\.html<\/loc>/);
});

test('rss controller returns robots.txt with clean-mode sitemap url', async (t) => {
  const previousSiteUrl = config.siteUrl;
  const previousUrlMode = config.urlMode;

  t.after(() => {
    config.siteUrl = previousSiteUrl;
    config.urlMode = previousUrlMode;
  });

  config.siteUrl = 'https://tanggui.cc/';
  config.urlMode = 'clean';

  const controller = new RssController();
  const res = createResponseCollector();

  await controller.robots({}, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/plain/i);
  assert.match(res.body, /User-agent: \*/);
  assert.match(res.body, /Disallow: \/admin\//);
  assert.match(res.body, /Sitemap: https:\/\/tanggui\.cc\/rss\/index\.xml/);
});

test('rss controller returns robots.txt with pathinfo sitemap url', async (t) => {
  const previousSiteUrl = config.siteUrl;
  const previousUrlMode = config.urlMode;

  t.after(() => {
    config.siteUrl = previousSiteUrl;
    config.urlMode = previousUrlMode;
  });

  config.siteUrl = 'https://tanggui.cc';
  config.urlMode = 'pathinfo';

  const controller = new RssController();
  const res = createResponseCollector();

  await controller.robots({}, res);

  assert.match(res.body, /Sitemap: https:\/\/tanggui\.cc\/index\.php\/rss\/index\.xml/);
});

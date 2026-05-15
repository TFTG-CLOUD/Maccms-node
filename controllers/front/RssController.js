const config = require('../../config');
const Vod = require('../../models/Vod');
const Type = require('../../models/Type');
const { macUrl } = require('../../utils/urlHelper');

const MAX_VOD_ITEMS = 5000;

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeSiteOrigin(siteUrl) {
  const raw = String(siteUrl || '').trim() || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

function buildAbsoluteUrl(pathname) {
  return normalizeSiteOrigin(config.siteUrl) + macUrl(pathname);
}

function formatLastMod(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function buildUrlNode(loc, lastmod = '') {
  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : '',
    '  </url>'
  ].filter(Boolean).join('\n');
}

class RssController {
  async robots(req, res) {
    const content = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /api/',
      `Sitemap: ${buildAbsoluteUrl('/rss/index.xml')}`
    ].join('\n') + '\n';

    res.set('Cache-Control', 'public, max-age=300');
    res.type('text/plain; charset=utf-8');
    return res.send(content);
  }

  async index(req, res) {
    const [types, vods] = await Promise.all([
      Type.find({ mid: 1, status: true }).sort({ sort: 1, _id: 1 }).lean(),
      Vod.find({ status: 1 }).sort({ updatedAt: -1, _id: -1 }).limit(MAX_VOD_ITEMS).lean()
    ]);

    const nodes = [];
    nodes.push(buildUrlNode(buildAbsoluteUrl('/'), formatLastMod(new Date())));

    for (const type of types) {
      nodes.push(
        buildUrlNode(
          buildAbsoluteUrl(`/vod/show/id/${type._id}.html`),
          formatLastMod(type.updatedAt || type.createdAt)
        )
      );
    }

    for (const vod of vods) {
      nodes.push(
        buildUrlNode(
          buildAbsoluteUrl(`/vod/detail/id/${vod._id}.html`),
          formatLastMod(vod.updatedAt || vod.createdAt || vod.publishDate)
        )
      );
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...nodes,
      '</urlset>'
    ].join('\n');

    res.set('Cache-Control', 'public, max-age=300');
    res.type('application/xml; charset=utf-8');
    return res.send(xml);
  }
}

module.exports = RssController;

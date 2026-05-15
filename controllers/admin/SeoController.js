const SeoSetting = require('../../models/SeoSetting');
const { DEFAULT_SEO_SETTINGS, clearSeoSettingsCache } = require('../../utils/seoConfig');

function buildPagePayload(body, pageKey) {
  return {
    title: String(body[`${pageKey}_title`] || '').trim(),
    keywords: String(body[`${pageKey}_keywords`] || '').trim(),
    description: String(body[`${pageKey}_description`] || '').trim()
  };
}

class SeoController {
  async index(req, res) {
    const setting = await SeoSetting.findOne({ key: 'default' }).lean();
    res.render('seo/index', {
      setting,
      defaults: DEFAULT_SEO_SETTINGS
    });
  }

  async update(req, res) {
    const pages = {};
    for (const pageKey of Object.keys(DEFAULT_SEO_SETTINGS)) {
      pages[pageKey] = buildPagePayload(req.body, pageKey);
    }

    await SeoSetting.findOneAndUpdate(
      { key: 'default' },
      { $set: { key: 'default', pages } },
      { upsert: true }
    );

    clearSeoSettingsCache();
    res.redirect('/admin/seo');
  }
}

module.exports = SeoController;

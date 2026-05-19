const config = require('../../config');
const Art = require('../../models/Art');
const Type = require('../../models/Type');
const { seoReplace } = require('../../utils/helpers');

class ArtController {
  async detail(req, res) {
    const id = req.mac.params.id;
    if (!id) return res.status(404).render('error', { message: '参数错误' });
    const art = await Art.findById(id).populate('type').lean();
    if (!art || art.status !== 1) return res.status(404).render('error', { message: '文章不存在' });
    Art.updateOne(
      { _id: art._id },
      { $inc: { hits: 1, hitsDay: 1, hitsWeek: 1, hitsMonth: 1 } },
      { timestamps: false }
    ).exec();
    const seoTemplates = res.locals.seoSettings || config.seo;
    res.render(art.tpl || 'art/detail', {
      maccms: config, obj: art, art, param: req.mac.params,
      seo: { title: seoReplace(seoTemplates.art.title, art, config), keywords: seoReplace(seoTemplates.art.keywords, art, config), description: seoReplace(seoTemplates.art.description, art, config) }
    });
  }

  async type(req, res) {
    const params = req.mac.params;
    const page = params.page || 1;
    const pagesize = 20;
    const filter = { status: 1 };
    if (params.id) filter.type = params.id;
    const total = await Art.countDocuments(filter);
    const list = await Art.find(filter).populate('type').sort({ updatedAt: -1 }).skip((page - 1) * pagesize).limit(pagesize).lean();
    const typeInfo = params.id ? await Type.findById(params.id).lean() : null;
    res.render('art/type', { maccms: config, list, param: params, page, total, type: typeInfo, obj: typeInfo, seo: { title: (typeInfo?.name || '文章') + ' - ' + config.siteName, keywords: '', description: '' } });
  }
}

module.exports = ArtController;

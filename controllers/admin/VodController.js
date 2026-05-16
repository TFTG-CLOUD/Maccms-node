const Vod = require('../../models/Vod');
const Type = require('../../models/Type');
const { clearCache } = require('../../middleware/pageCache');
const { clearRuntimeCache } = require('../../utils/runtimeCache');
const { buildMixedIdCandidates, findOneByMixedId } = require('../../utils/front');

function invalidateFrontCaches() {
  clearRuntimeCache('front:');
  clearCache();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class VodController {
  async index(req, res) {
    const page = parseInt(req.query.page) || 1;
    const pagesize = 20;
    const filter = {};
    if (req.query.status !== undefined && req.query.status !== '') {
      const status = parseInt(req.query.status, 10);
      if (!Number.isNaN(status)) filter.status = status;
    }
    if (req.query.type) filter.type = { $in: buildMixedIdCandidates(req.query.type) };
    if (req.query.wd) filter.name = new RegExp(escapeRegex(req.query.wd));
    const total = await Vod.countDocuments(filter);
    const types = await Type.find({ mid: 1, status: true }).sort({ sort: 1 }).lean();
    const typeMap = new Map(types.map((item) => [String(item._id), item]));
    const list = await Vod.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pagesize)
      .limit(pagesize)
      .lean();
    const normalizedList = list.map((item) => {
      const typeInfo = typeMap.get(String(item.type));
      return {
        ...item,
        typeName: typeInfo?.name || (item.type?.name || '')
      };
    });

    res.render('vod/index', { list: normalizedList, types, page, total, pagesize, filter: req.query });
  }
  async create(req, res) {
    req.body.playUrls = Vod.parsePlayUrls(req.body.vod_play_url_raw, req.body.vod_play_from_raw);
    delete req.body.vod_play_url_raw;
    delete req.body.vod_play_from_raw;
    await Vod.create(req.body);
    invalidateFrontCaches();
    res.redirect('/admin/vod');
  }
  async edit(req, res) {
    const vod = await findOneByMixedId(Vod, req.params.id);
    if (!vod) return res.status(404).render('error', { message: '影片不存在' });
    const types = await Type.find({ mid: 1 }).lean();
    res.render('vod/edit', { vod, types });
  }
  async update(req, res) {
    req.body.playUrls = Vod.parsePlayUrls(req.body.vod_play_url_raw, req.body.vod_play_from_raw);
    delete req.body.vod_play_url_raw;
    delete req.body.vod_play_from_raw;
    await Vod.findOneAndUpdate({ _id: { $in: buildMixedIdCandidates(req.params.id) } }, req.body);
    invalidateFrontCaches();
    res.redirect('/admin/vod');
  }
  async remove(req, res) {
    await Vod.findOneAndDelete({ _id: { $in: buildMixedIdCandidates(req.params.id) } });
    invalidateFrontCaches();
    res.json({ code: 1, msg: 'ok' });
  }
  async audit(req, res) {
    const { status } = req.body;
    await Vod.findOneAndUpdate({ _id: { $in: buildMixedIdCandidates(req.params.id) } }, { status: parseInt(status) });
    invalidateFrontCaches();
    res.json({ code: 1, msg: '审核完成' });
  }
}

module.exports = VodController;

const Vod = require('../../models/Vod');
const Type = require('../../models/Type');
const FilterAliasSetting = require('../../models/FilterAliasSetting');
const { clearVodPageCaches } = require('../../middleware/pageCache');
const { clearRuntimeCache } = require('../../utils/runtimeCache');
const { buildMixedIdCandidates, findOneByMixedId } = require('../../utils/front');
const {
  DEFAULT_FILTER_ALIAS_SETTINGS,
  applyVodFilterMetadata,
  buildAliasLookup,
  getFilterAliasSettings
} = require('../../utils/filterAliasConfig');

async function invalidateFrontCaches(vodIds = []) {
  await Promise.all([
    clearRuntimeCache('count:'),
    clearRuntimeCache('query:'),
    clearRuntimeCache('front:'),
    clearVodPageCaches(vodIds)
  ]);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildVodPayload(body = {}) {
  let aliasLookup;
  try {
    aliasLookup = buildAliasLookup(await getFilterAliasSettings(FilterAliasSetting));
  } catch (error) {
    aliasLookup = buildAliasLookup(DEFAULT_FILTER_ALIAS_SETTINGS);
  }
  const payload = {
    ...body,
    playUrls: Vod.parsePlayUrls(body.vod_play_url_raw, body.vod_play_from_raw)
  };

  delete payload.vod_play_url_raw;
  delete payload.vod_play_from_raw;

  if (payload.year !== undefined && payload.year !== '') {
    const parsedYear = parseInt(payload.year, 10);
    payload.year = Number.isNaN(parsedYear) ? 0 : parsedYear;
  }

  if (payload.total !== undefined && payload.total !== '') {
    const parsedTotal = parseInt(payload.total, 10);
    payload.total = Number.isNaN(parsedTotal) ? 0 : parsedTotal;
  }

  if (payload.hits !== undefined && payload.hits !== '') {
    const parsedHits = parseInt(payload.hits, 10);
    payload.hits = Number.isNaN(parsedHits) ? 0 : parsedHits;
  }

  if (payload.score !== undefined && payload.score !== '') {
    const parsedScore = parseFloat(payload.score);
    payload.score = Number.isNaN(parsedScore) ? 0 : parsedScore;
  }

  if (payload.doubanScore !== undefined && payload.doubanScore !== '') {
    const parsedDoubanScore = parseFloat(payload.doubanScore);
    payload.doubanScore = Number.isNaN(parsedDoubanScore) ? 0 : parsedDoubanScore;
  }

  if (payload.status !== undefined) {
    const parsedStatus = parseInt(payload.status, 10);
    payload.status = Number.isNaN(parsedStatus) ? 0 : parsedStatus;
  }

  payload.tags = Array.isArray(payload.tags)
    ? payload.tags
    : String(payload.tags || '')
      .split(/[\s,，/、|;；]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  return applyVodFilterMetadata(payload, aliasLookup);
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
    const payload = await buildVodPayload(req.body);
    const vod = await Vod.create(payload);
    await invalidateFrontCaches([vod._id]);
    res.redirect('/admin/vod');
  }
  async edit(req, res) {
    const vod = await findOneByMixedId(Vod, req.params.id);
    if (!vod) return res.status(404).render('error', { message: '影片不存在' });
    const types = await Type.find({ mid: 1 }).lean();
    res.render('vod/edit', { vod, types });
  }
  async update(req, res) {
    const payload = await buildVodPayload(req.body);
    const updatedVod = await Vod.findOneAndUpdate({ _id: { $in: buildMixedIdCandidates(req.params.id) } }, payload, { new: true });
    await invalidateFrontCaches(updatedVod ? [updatedVod._id] : [req.params.id]);
    res.redirect('/admin/vod');
  }
  async remove(req, res) {
    const removedVod = await Vod.findOneAndDelete({ _id: { $in: buildMixedIdCandidates(req.params.id) } });
    await invalidateFrontCaches(removedVod ? [removedVod._id] : [req.params.id]);
    res.json({ code: 1, msg: 'ok' });
  }
  async audit(req, res) {
    const { status } = req.body;
    const auditedVod = await Vod.findOneAndUpdate({ _id: { $in: buildMixedIdCandidates(req.params.id) } }, { status: parseInt(status) }, { new: true });
    await invalidateFrontCaches(auditedVod ? [auditedVod._id] : [req.params.id]);
    res.json({ code: 1, msg: '审核完成' });
  }
}

module.exports = VodController;

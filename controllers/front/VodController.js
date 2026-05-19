const config = require('../../config');
const Vod = require('../../models/Vod');
const Type = require('../../models/Type');
const { seoReplace, sanitizePlainText, encodePlayerPayload } = require('../../utils/helpers');
const { macUrl } = require('../../utils/urlHelper');
const {
  buildVodShowFilter,
  buildVodShowBasePath,
  buildVodShowPath,
  buildVodRatingMeta,
  buildPlaylistSections,
  buildMixedTypeCandidates,
  findOneByMixedId,
  buildPlayerSource,
  normalizeMediaEntity,
  normalizeMediaList,
  resolveTypeSelection
} = require('../../utils/front');
const { readCountThroughCache, readQueryThroughCache } = require('../../utils/countCache');

const LIST_FIELDS = '_id name actor pic remarks serial isEnd';
const RELATED_FIELDS = '_id name actor pic remarks serial isEnd';
const LIST_PAGE_SIZE = 24;
const RELATED_VOD_LIMIT = 12;
const VOD_SHOW_LIST_CACHE_TTL_MS = Math.max(1000, Number(process.env.VOD_SHOW_LIST_CACHE_TTL_MS || 15 * 1000));

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildVodViewModel(vod) {
  const normalizedVod = normalizeMediaEntity(vod);
  const contentText = sanitizePlainText(vod?.content || '');
  return {
    ...normalizedVod,
    contentText,
    contentSummary: contentText.substring(0, 100)
  };
}

function buildPageNav(baseUrl, page, totalPages) {
  const safeTotalPages = Math.max(1, totalPages);
  const visibleCount = Math.min(safeTotalPages, 10);
  const start = Math.max(1, Math.min(page - Math.floor(visibleCount / 2), safeTotalPages - visibleCount + 1));
  return {
    baseUrl,
    current: page,
    totalPages: safeTotalPages,
    prev: Math.max(1, page - 1),
    next: Math.min(safeTotalPages, page + 1),
    nums: Array.from({ length: visibleCount }, (_, index) => start + index)
  };
}

function markActiveNav(res, typeId) {
  const navTypes = Array.isArray(res.locals.types) ? res.locals.types : [];
  const allTypes = Array.isArray(res.locals.allTypes) ? res.locals.allTypes : [];
  if (!navTypes.length || !typeId) return;

  const typeContext = resolveTypeSelection(allTypes, typeId, res.locals.filterAliasLookup || {});
  const activeId = String(typeContext.rootType?._id || typeContext.currentType?._id || typeId);
  navTypes.forEach((item) => {
    item.active = String(item._id) === activeId;
  });
}

function getClientIp(req) {
  if (req.ip) return String(req.ip).trim();

  const forwardedChain = parseForwardedFor(req.headers['x-forwarded-for']);
  if (forwardedChain.length > 0) return forwardedChain[0];

  return String(req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown').trim() || 'unknown';
}

class VodController {
  async detail(req, res) {
    const id = req.mac.params.id;
    if (!id) return res.status(404).render('error', { message: '参数错误' });

    const vod = await findOneByMixedId(Vod, id);
    if (!vod || vod.status !== 1) return res.status(404).render('error', { message: '影片不存在或未审核' });

    const relatedVods = await Vod.find({
      type: { $in: buildMixedTypeCandidates([vod.type]) },
      _id: { $ne: vod._id },
      status: 1
    }).select(RELATED_FIELDS).sort({ hits: -1 }).limit(RELATED_VOD_LIMIT).lean();

    const seoTemplates = res.locals.seoSettings || config.seo;
    const normalizedVod = buildVodViewModel(vod);
    const playlistSections = buildPlaylistSections(vod, { activeSid: 1, activeNid: Number(req.mac.params.nid || 1) || 1 });
    markActiveNav(res, vod.type);
    const seo = {
      title: seoReplace(seoTemplates.vod.title, vod, config),
      keywords: seoReplace(seoTemplates.vod.keywords, vod, config),
      description: seoReplace(seoTemplates.vod.description, vod, config)
    };

    res.render('stui/vod/detail', {
      maccms: config,
      obj: normalizedVod,
      vod: normalizedVod,
      playlistSections,
      ratingMeta: buildVodRatingMeta(vod),
      param: { ...req.mac.params, sid: 1, nid: 1 },
      relatedVods: normalizeMediaList(relatedVods),
      seo
    });
  }

  async show(req, res) {
    const params = req.mac.params;
    const uiParams = { ...params };
    delete uiParams.letter;
    const page = params.page || 1;
    const pagesize = LIST_PAGE_SIZE;
    const seoTemplates = res.locals.seoSettings || config.seo;
    const filterAliasLookup = res.locals.filterAliasLookup || {};
    const allTypes = Array.isArray(res.locals.allTypes) && res.locals.allTypes.length
      ? res.locals.allTypes
      : await Type.find({ mid: 1, status: true }).sort({ sort: 1 }).lean();
    const typeContext = resolveTypeSelection(allTypes, params.id, filterAliasLookup);
    const currentTypeId = typeContext.currentType?._id ?? params.id;
    const filter = buildVodShowFilter(params, typeContext, filterAliasLookup);

    const sortOptions = {};
    const by = params.by || 'time';
    switch (by) {
      case 'hits': sortOptions.hits = -1; break;
      case 'score': sortOptions.score = -1; break;
      case 'id': sortOptions._id = -1; break;
      default: sortOptions.updatedAt = -1;
    }

    const [total, list] = await Promise.all([
      readCountThroughCache('vod:show', filter, () => Vod.countDocuments(filter)),
      readQueryThroughCache('vod:show:list', {
        filter,
        sortOptions,
        page,
        pagesize,
        fields: LIST_FIELDS
      }, () => Vod.find(filter)
        .select(LIST_FIELDS)
        .sort(sortOptions)
        .skip((page - 1) * pagesize)
        .limit(pagesize)
        .lean(), {
        ttlMs: VOD_SHOW_LIST_CACHE_TTL_MS
      })
    ]);

    const totalPages = Math.ceil(total / pagesize);
    const pageNav = buildPageNav(
      buildVodShowBasePath(currentTypeId, { ...uiParams, page: null }),
      page,
      totalPages
    );

    res.render('stui/vod/show', {
      maccms: config,
      list: normalizeMediaList(list),
      param: uiParams,
      page,
      pagesize,
      total,
      obj: typeContext.rootType || typeContext.currentType,
      type: typeContext.currentType,
      subTypes: typeContext.subTypes,
      filterOptions: typeContext.filterOptions,
      groupTypeId: typeContext.rootType?._id || currentTypeId,
      buildShowUrl: (overrides = {}) => buildVodShowPath(currentTypeId, { ...uiParams, ...overrides }),
      buildRootShowUrl: () => buildVodShowPath(typeContext.rootType?._id || currentTypeId),
      buildTypeShowUrl: (typeId) => buildVodShowPath(typeId),
      pageNav,
      seo: {
        title: seoReplace(seoTemplates.show?.title || '', { typeName: typeContext.currentType?.name || '筛选' }, config),
        keywords: seoReplace(seoTemplates.show?.keywords || '', { typeName: typeContext.currentType?.name || '筛选' }, config),
        description: seoReplace(seoTemplates.show?.description || '', { typeName: typeContext.currentType?.name || '筛选' }, config)
      }
    });
  }

  async type(req, res) {
    const params = req.mac.params;
    const page = params.page || 1;
    const pagesize = LIST_PAGE_SIZE;
    const filter = { status: 1 };
    const seoTemplates = res.locals.seoSettings || config.seo;
    const filterAliasLookup = res.locals.filterAliasLookup || {};
    const allTypes = Array.isArray(res.locals.allTypes) && res.locals.allTypes.length
      ? res.locals.allTypes
      : await Type.find({ mid: 1, status: true }).sort({ sort: 1 }).lean();
    const typeContext = resolveTypeSelection(allTypes, params.id, filterAliasLookup);
    const currentTypeId = typeContext.currentType?._id ?? params.id;

    if (params.id) {
      const typeCandidates = buildMixedTypeCandidates(
        typeContext.filterTypeIds.length ? typeContext.filterTypeIds : [currentTypeId]
      );
      filter.type = typeCandidates.length === 1 ? typeCandidates[0] : { $in: typeCandidates };
    }

    const [total, list] = await Promise.all([
      readCountThroughCache('vod:type', filter, () => Vod.countDocuments(filter)),
      Vod.find(filter)
        .select(LIST_FIELDS)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pagesize)
        .limit(pagesize)
        .lean()
    ]);

    const totalPages = Math.ceil(total / pagesize);
    const pageNav = buildPageNav(buildVodShowBasePath(currentTypeId), page, totalPages);

    res.render('stui/vod/type', {
      maccms: config,
      list: normalizeMediaList(list),
      param: params,
      page,
      pagesize,
      total,
      obj: typeContext.rootType || typeContext.currentType,
      type: typeContext.currentType,
      pageNav,
      seo: {
        title: seoReplace(seoTemplates.type?.title || '', { typeName: typeContext.currentType?.name || '分类' }, config),
        keywords: seoReplace(seoTemplates.type?.keywords || '', { typeName: typeContext.currentType?.name || '分类' }, config),
        description: seoReplace(seoTemplates.type?.description || '', { typeName: typeContext.currentType?.name || '分类' }, config)
      }
    });
  }

  async play(req, res) {
    const { id, sid, nid } = req.mac.params;
    if (!id) return res.status(404).render('error', { message: '参数错误' });

    const vod = await findOneByMixedId(Vod, id);
    if (!vod || vod.status !== 1) return res.status(404).render('error', { message: '影片不存在' });

    const serverIndex = Math.max(0, (sid || 1) - 1);
    const episodeIndex = Math.max(0, (nid || 1) - 1);

    const seoTemplates = res.locals.seoSettings || config.seo;
    const playServer = vod.playUrls?.[serverIndex];
    const episode = playServer?.episodes?.[episodeIndex];

    if (!episode) return res.status(404).render('error', { message: '播放地址不存在' });
    const currentEpisodes = playServer?.episodes || [];
    const prevEpisode = episodeIndex > 0 ? currentEpisodes[episodeIndex - 1] : null;
    const nextEpisode = episodeIndex < currentEpisodes.length - 1 ? currentEpisodes[episodeIndex + 1] : null;
    const playerSource = buildPlayerSource(episode.url);
    const playerPayload = encodePlayerPayload({
      kind: vod.copyright == 1 ? 'copyright' : (playerSource && playerSource.useVideo ? 'video' : 'iframe'),
      url: vod.copyright == 1
        ? `/static/player/banquan.html?url=${encodeURIComponent(episode ? episode.url : '')}`
        : (playerSource ? playerSource.url : episode.url),
      mime: playerSource && playerSource.useVideo ? (playerSource.mimeType || '') : '',
      hls: Boolean(playerSource && playerSource.kind == 'hls' && playerSource.useVideo)
    });
    const playlistSections = buildPlaylistSections(vod, { activeSid: serverIndex + 1, activeNid: episode.nid || (episodeIndex + 1) });

    const relatedVods = await Vod.find({
      type: { $in: buildMixedTypeCandidates([vod.type]) },
      _id: { $ne: vod._id },
      status: 1
    }).select(RELATED_FIELDS).sort({ hits: -1 }).limit(RELATED_VOD_LIMIT).lean();

    const normalizedVod = buildVodViewModel(vod);
    markActiveNav(res, vod.type);
    res.render('stui/vod/play', {
      maccms: config,
      obj: normalizedVod,
      vod: normalizedVod,
      param: req.mac.params,
      episode,
      playServer,
      playlistSections,
      playerSource,
      playerInfo: {
        linkPrev: prevEpisode ? macUrl(`/vod/play/id/${vod._id}/sid/${serverIndex + 1}/nid/${prevEpisode.nid}.html`) : '',
        linkNext: nextEpisode ? macUrl(`/vod/play/id/${vod._id}/sid/${serverIndex + 1}/nid/${nextEpisode.nid}.html`) : ''
      },
      serverIndex,
      episodeIndex,
      playerPayload,
      playerJs: '',
      relatedVods: normalizeMediaList(relatedVods),
      seo: {
        title: seoReplace(seoTemplates.play?.title || '', { ...vod, playerName: playServer?.server || `播放线路 ${serverIndex + 1}`, episodeName: episode.name || `第${episode.nid || (episodeIndex + 1)}集` }, config),
        keywords: seoReplace(seoTemplates.play?.keywords || '', { ...vod, playerName: playServer?.server || `播放线路 ${serverIndex + 1}`, episodeName: episode.name || `第${episode.nid || (episodeIndex + 1)}集` }, config),
        description: seoReplace(seoTemplates.play?.description || '', { ...vod, playerName: playServer?.server || `播放线路 ${serverIndex + 1}`, episodeName: episode.name || `第${episode.nid || (episodeIndex + 1)}集` }, config)
      }
    });
  }

  async search(req, res) {
    const params = req.mac.params;
    const wd = String(params.wd || '').trim();
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const pagesize = LIST_PAGE_SIZE;
    const seoTemplates = res.locals.seoSettings || config.seo;

    console.log(getClientIp(req) + 'Search:' + wd);

    if (!wd) {
      return res.render('stui/vod/search', {
        maccms: config,
        list: [],
        param: params,
        wd: '',
        page: 1,
        total: 0,
        pageNav: null,
        seo: {
          title: seoReplace(seoTemplates.search?.title || '', { searchWord: '' }, config),
          keywords: seoReplace(seoTemplates.search?.keywords || '', { searchWord: '' }, config),
          description: seoReplace(seoTemplates.search?.description || '', { searchWord: '' }, config)
        }
      });
    }

    const keywordRegex = new RegExp(escapeRegex(wd));
    const query = {
      status: 1,
      name: keywordRegex
    };

    let list = [];
    try {
      list = await Vod.find(query)
        .select(LIST_FIELDS)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pagesize)
        .limit(pagesize + 1)
        .maxTimeMS(1500)
        .lean();
    } catch (error) {
      if (error?.code === 50 || error?.codeName === 'MaxTimeMSExpired') {
        return res.status(503).render('error', { message: '搜索超时，请稍后再试或换个关键词' });
      }
      throw error;
    }

    const hasMore = list.length > pagesize;
    if (hasMore) list = list.slice(0, pagesize);
    const total = (page - 1) * pagesize + list.length + (hasMore ? 1 : 0);
    const totalPages = hasMore ? page + 1 : page;
    const pageNav = buildPageNav(req.path.replace(/page\/\d+/, '').replace(/\.html$/, '').replace(/\/$/, '') + '/', page, totalPages);

    res.render('stui/vod/search', {
      maccms: config,
      list: normalizeMediaList(list),
      param: params,
      wd,
      page,
      pagesize,
      total,
      pageNav,
      seo: {
        title: seoReplace(seoTemplates.search?.title || '', { searchWord: wd }, config),
        keywords: seoReplace(seoTemplates.search?.keywords || '', { searchWord: wd }, config),
        description: seoReplace(seoTemplates.search?.description || '', { searchWord: wd }, config)
      }
    });
  }

  async plot(req, res) {
    const id = req.mac.params.id;
    if (!id) return res.status(404).render('error', { message: '参数错误' });

    const vod = await findOneByMixedId(Vod, id);
    if (!vod) return res.status(404).render('error', { message: '影片不存在' });

    const normalizedVod = buildVodViewModel(vod);
    res.render('vod/plot', {
      maccms: config,
      obj: normalizedVod,
      vod: normalizedVod,
      param: req.mac.params,
      seo: {
        title: vod.name + ' 剧情介绍 - ' + config.siteName,
        keywords: vod.name,
        description: sanitizePlainText(vod.content || '').substring(0, 200)
      }
    });
  }
}

module.exports = VodController;

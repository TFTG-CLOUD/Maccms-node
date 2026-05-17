const mongoose = require('mongoose');
const config = require('../config');
const { normalizeKeywordList } = require('./filterAliasConfig');
const { macUrl } = require('./urlHelper');

const HOME_TITLE_ALIASES = {
  连续剧: '电视剧'
};
const VOD_LETTER_OPTIONS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0-9'];

function idKey(id) {
  return id === null || id === undefined ? '' : String(id);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function isNumericLikeId(id) {
  return typeof id === 'number' || /^\d+$/.test(idKey(id));
}

function comparePreferredType(left, right) {
  const leftNumeric = isNumericLikeId(left?._id) ? 1 : 0;
  const rightNumeric = isNumericLikeId(right?._id) ? 1 : 0;
  if (leftNumeric !== rightNumeric) return rightNumeric - leftNumeric;

  const leftExtend = Object.keys(left?.extend || {}).length;
  const rightExtend = Object.keys(right?.extend || {}).length;
  if (leftExtend !== rightExtend) return rightExtend - leftExtend;

  const leftSort = Number(left?.sort || 0);
  const rightSort = Number(right?.sort || 0);
  if (leftSort !== rightSort) return leftSort - rightSort;

  return idKey(left?._id).localeCompare(idKey(right?._id));
}

function pickPreferredType(types) {
  return [...types].sort(comparePreferredType)[0] || null;
}

function dedupeByName(types) {
  const grouped = new Map();
  for (const item of types || []) {
    if (!item?.name) continue;
    const list = grouped.get(item.name) || [];
    list.push(item);
    grouped.set(item.name, list);
  }

  return [...grouped.values()]
    .map((group) => pickPreferredType(group))
    .filter(Boolean)
    .sort((left, right) => Number(left.sort || 0) - Number(right.sort || 0));
}

function dedupeValues(values) {
  const seen = new Set();
  const result = [];
  for (const item of values) {
    if (!hasValue(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function decodeUnicodeText(input) {
  if (typeof input !== 'string') return input || '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!/\\u[0-9a-fA-F]{4}/.test(trimmed)) return trimmed;

  try {
    const escaped = trimmed
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
    return JSON.parse(`"${escaped}"`);
  } catch (error) {
    return trimmed;
  }
}

function normalizeFilterValue(value) {
  if (!hasValue(value)) return '';
  return decodeUnicodeText(String(value).trim());
}

function buildLetterCondition(rawLetter) {
  const letterValue = normalizeFilterValue(rawLetter).toUpperCase();
  if (!letterValue) return null;

  if (letterValue === '0-9') {
    return { letter: /^[0-9]$/ };
  }

  return { letter: letterValue };
}

function buildVodShowFilter(params = {}, typeContext = {}, aliasLookup = {}) {
  const filter = { status: 1 };
  const currentTypeId = typeContext.currentType?._id ?? params.id;

  if (params.id) {
    filter.type = typeContext.filterTypeIds?.length
      ? { $in: typeContext.filterTypeIds }
      : currentTypeId;
  }

  const andConditions = [buildLetterCondition(params.letter)].filter(Boolean);
  const filterTokens = dedupeValues([
    ...normalizeKeywordList('area', params.area, aliasLookup).map((item) => `area:${item}`),
    ...(normalizeFilterValue(params.year) ? [`year:${normalizeFilterValue(params.year)}`] : []),
    ...normalizeKeywordList('class', params.class, aliasLookup).map((item) => `class:${item}`),
    ...normalizeKeywordList('lang', params.lang, aliasLookup).map((item) => `lang:${item}`)
  ]);

  if (andConditions.length) {
    filter.$and = andConditions;
  }
  if (filterTokens.length) {
    filter.filterTokens = { $all: filterTokens };
  }

  return filter;
}

function splitFilterValues(raw) {
  if (Array.isArray(raw)) {
    return dedupeValues(raw.map((item) => decodeUnicodeText(String(item || '').trim())));
  }
  if (typeof raw !== 'string') return [];
  return dedupeValues(
    raw
      .split(',')
      .map((item) => decodeUnicodeText(item.trim()))
      .filter(Boolean)
  );
}

function getVodLetterOptions() {
  return [...VOD_LETTER_OPTIONS];
}

function mergeTypeExtends(types, aliasLookup = {}) {
  const source = Array.isArray(types) ? types : [];
  return {
    areas: dedupeValues(source.flatMap((item) => normalizeKeywordList('area', item?.extend?.area, aliasLookup))),
    years: dedupeValues(source.flatMap((item) => splitFilterValues(item?.extend?.year))),
    classes: dedupeValues(source.flatMap((item) => normalizeKeywordList('class', item?.extend?.class, aliasLookup))),
    langs: dedupeValues(source.flatMap((item) => normalizeKeywordList('lang', item?.extend?.lang, aliasLookup)))
  };
}

function normalizePicUrl(pic) {
  const value = typeof pic === 'string' ? pic.trim() : '';
  if (!value) return '/static/img/tanggui-qrcode.png';
  if (/\/static\/img\/load(?:_[a-z])?\.gif$/i.test(value) || /(^|\/)load(?:_[a-z])?\.gif$/i.test(value)) {
    return '/static/img/tanggui-qrcode.png';
  }
  if (/^(https?:)?\/\//i.test(value)) return value.startsWith('//') ? `https:${value}` : value;
  if (/^(data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return `/${value}`;
}

function normalizeMediaEntity(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  const normalized = { ...entity };
  if (Object.prototype.hasOwnProperty.call(normalized, 'pic')) {
    normalized.pic = normalizePicUrl(normalized.pic);
  }
  if (normalized.logo) {
    normalized.logo = normalizePicUrl(normalized.logo);
  }
  return normalized;
}

function normalizeMediaList(list) {
  return Array.isArray(list) ? list.map((item) => normalizeMediaEntity(item)) : [];
}

function findTypeById(types, typeId) {
  const expected = idKey(typeId);
  return (types || []).find((item) => idKey(item?._id) === expected) || null;
}

function selectNavTypes(types) {
  return dedupeByName((types || []).filter((item) => item && item.status !== false && !hasValue(item.pid)));
}

function resolveTypeSelection(types, requestedId, aliasLookup = {}) {
  const allTypes = (types || []).filter(Boolean);
  const currentType = findTypeById(allTypes, requestedId);
  if (!currentType) {
    return {
      currentType: null,
      currentAliases: [],
      rootType: null,
      subTypes: [],
      filterTypeIds: [],
      filterOptions: { areas: [], years: [], classes: [], langs: [] }
    };
  }

  const currentAliases = allTypes.filter((item) => item.name === currentType.name);
  const currentAliasIds = new Set(currentAliases.map((item) => idKey(item._id)));
  const directChildren = allTypes.filter((item) => currentAliasIds.has(idKey(item.pid)));

  let rootCandidates = currentAliases;
  let subTypes = directChildren;

  if (!subTypes.length) {
    const parentIds = dedupeValues(currentAliases.map((item) => item.pid).filter(hasValue));
    const parents = parentIds.map((parentId) => findTypeById(allTypes, parentId)).filter(Boolean);
    rootCandidates = parents.length ? dedupeByName(allTypes.filter((item) => parents.some((parent) => parent.name === item.name))) : currentAliases;

    const rootCandidateIds = new Set(rootCandidates.map((item) => idKey(item._id)));
    subTypes = allTypes.filter((item) => rootCandidateIds.has(idKey(item.pid)));
  }

  const subTypeNames = new Set(subTypes.map((item) => item.name));
  const subTypeAliases = allTypes.filter((item) => subTypeNames.has(item.name));
  const displaySubTypes = dedupeByName([...subTypes, ...subTypeAliases]);

  const filterIdMap = new Map();
  for (const item of currentAliases) {
    filterIdMap.set(idKey(item._id), item._id);
  }

  if (directChildren.length) {
    for (const item of [...directChildren, ...subTypeAliases]) {
      filterIdMap.set(idKey(item._id), item._id);
    }
  }

  const rootType = pickPreferredType(rootCandidates) || currentType;

  return {
    currentType,
    currentAliases,
    rootType,
    subTypes: displaySubTypes,
    filterTypeIds: [...filterIdMap.values()],
    filterOptions: mergeTypeExtends(rootCandidates, aliasLookup),
    displayName: HOME_TITLE_ALIASES[rootType?.name] || rootType?.name || currentType.name
  };
}

function buildVodShowPath(typeId, params = {}) {
  const segments = ['/vod', 'show'];
  if (hasValue(typeId)) {
    segments.push('id', encodeURIComponent(idKey(typeId)));
  }

  const orderedKeys = ['area', 'year', 'letter', 'class', 'lang', 'by', 'page'];
  for (const key of orderedKeys) {
    const value = params[key];
    if (!hasValue(value)) continue;
    segments.push(key, encodeURIComponent(String(value)));
  }

  let path = `${segments.join('/')}.html`;
  // urlMode === 'pathinfo' 时添加 /index.php 前缀
  if (config.urlMode === 'pathinfo') {
    path = '/index.php' + path;
  }
  return path;
}

function buildVodShowBasePath(typeId, params = {}) {
  return buildVodShowPath(typeId, params).replace(/\.html$/, '/');
}

function formatDisplayScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  return num.toFixed(1);
}

function buildVodRatingMeta(vod) {
  const doubanId = typeof vod?.doubanId === 'string'
    ? vod.doubanId.trim()
    : idKey(vod?.doubanId);

  return {
    doubanScore: formatDisplayScore(vod?.doubanScore),
    doubanId,
    doubanUrl: doubanId ? `https://movie.douban.com/subject/${encodeURIComponent(doubanId)}/` : '',
    siteScore: formatDisplayScore(vod?.score)
  };
}

function buildPlayerSource(url) {
  const sourceUrl = typeof url === 'string' ? url.trim() : '';
  if (!sourceUrl) {
    return {
      url: '',
      kind: 'empty',
      mimeType: '',
      useVideo: false
    };
  }

  if (/\.m3u8(\?|$)/i.test(sourceUrl)) {
    return {
      url: sourceUrl,
      kind: 'hls',
      mimeType: 'application/vnd.apple.mpegurl',
      useVideo: true
    };
  }

  if (/\.mp4(\?|$)/i.test(sourceUrl)) {
    return {
      url: sourceUrl,
      kind: 'video',
      mimeType: 'video/mp4',
      useVideo: true
    };
  }

  if (/\.webm(\?|$)/i.test(sourceUrl)) {
    return {
      url: sourceUrl,
      kind: 'video',
      mimeType: 'video/webm',
      useVideo: true
    };
  }

  if (/\.ogg(\?|$)/i.test(sourceUrl)) {
    return {
      url: sourceUrl,
      kind: 'video',
      mimeType: 'video/ogg',
      useVideo: true
    };
  }

  return {
    url: sourceUrl,
    kind: 'iframe',
    mimeType: '',
    useVideo: false
  };
}

function buildPlaylistSections(vod = {}, options = {}) {
  const vodId = idKey(vod?._id);
  const activeSid = Math.max(1, Number(options.activeSid || 1));
  const activeNid = Math.max(1, Number(options.activeNid || 1));
  const playUrls = Array.isArray(vod?.playUrls) ? vod.playUrls : [];

  return playUrls.map((server, serverIndex) => {
    const index = serverIndex + 1;
    const episodes = Array.isArray(server?.episodes) ? server.episodes : [];
    const isActiveSource = index === activeSid;

    return {
      accordionId: `playlist_${index}`,
      index,
      title: `播放线路 ${index}`,
      rawName: String(server?.server || '').trim(),
      countText: `${episodes.length} 个地址`,
      isOpen: isActiveSource,
      isActiveSource,
      episodes: episodes.map((episode, episodeIndex) => {
        const nid = Number(episode?.nid || (episodeIndex + 1));
        return {
          nid,
          label: String(episode?.name || '').trim() || `第${episodeIndex + 1}集`,
          href: macUrl(`/vod/play/id/${vodId}/sid/${index}/nid/${nid}.html`),
          isActive: isActiveSource && nid === activeNid
        };
      })
    };
  });
}

function buildMixedIdCandidates(id) {
  const raw = idKey(id);
  const candidates = [];
  const seen = new Set();

  function pushCandidate(value) {
    const key = value instanceof mongoose.Types.ObjectId
      ? `oid:${value.toString()}`
      : `${typeof value}:${String(value)}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(value);
  }

  pushCandidate(id);

  if (/^\d+$/.test(raw)) {
    const numberId = Number(raw);
    if (!Number.isNaN(numberId)) pushCandidate(numberId);
  }

  if (mongoose.Types.ObjectId.isValid(raw)) {
    pushCandidate(new mongoose.Types.ObjectId(raw));
  }

  return candidates;
}

async function findOneByMixedId(Model, id, populate = '') {
  const candidates = buildMixedIdCandidates(id);
  let query = Model.findOne({ _id: { $in: candidates } });
  if (populate) query = query.populate(populate);
  return query.lean();
}

module.exports = {
  buildPlaylistSections,
  buildMixedIdCandidates,
  buildPlayerSource,
  buildVodRatingMeta,
  buildVodShowFilter,
  buildVodShowBasePath,
  buildVodShowPath,
  decodeUnicodeText,
  findOneByMixedId,
  getVodLetterOptions,
  mergeTypeExtends,
  normalizeMediaEntity,
  normalizeMediaList,
  normalizePicUrl,
  resolveTypeSelection,
  selectNavTypes,
  splitFilterValues
};

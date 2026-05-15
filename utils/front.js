const mongoose = require('mongoose');
const config = require('../config');

const CANONICAL_ROOT_NAMES = ['电影', '连续剧', '综艺', '动漫'];
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expandAreaAliases(rawValue) {
  const value = normalizeFilterValue(rawValue);
  if (!value) return [];

  const values = new Set([value]);
  const aliasPairs = {
    大陆: '中国大陆',
    中国大陆: '大陆',
    香港: '中国香港',
    中国香港: '香港',
    台湾: '中国台湾',
    中国台湾: '台湾',
    澳门: '中国澳门',
    中国澳门: '澳门'
  };

  if (aliasPairs[value]) values.add(aliasPairs[value]);
  return [...values];
}

function buildDelimitedValueRegex(values) {
  const tokens = dedupeValues((values || []).map((item) => normalizeFilterValue(item)).filter(Boolean));
  if (!tokens.length) return null;
  const delimiter = '[\\s,，/、|;；]+';
  return new RegExp(`(?:^|${delimiter})(?:${tokens.map(escapeRegex).join('|')})(?:$|${delimiter})`, 'i');
}

function buildExactOrRegexCondition(field, rawValue, options = {}) {
  const value = normalizeFilterValue(rawValue);
  if (!value) return null;

  const exactValues = dedupeValues([value, ...(options.aliases || [])].map((item) => normalizeFilterValue(item)).filter(Boolean));
  const regex = buildDelimitedValueRegex(exactValues);
  const orConditions = [{ [field]: { $in: exactValues } }];

  if (regex) {
    orConditions.push({ [field]: regex });
  }

  return orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
}

function buildYearCondition(rawYear) {
  const yearValue = normalizeFilterValue(rawYear);
  if (!yearValue) return null;

  const exactValues = [yearValue];
  if (/^\d+$/.test(yearValue)) {
    exactValues.push(Number(yearValue));
  }

  const uniqueValues = dedupeValues(exactValues);
  if (uniqueValues.length === 1) {
    return { year: uniqueValues[0] };
  }

  return {
    $or: uniqueValues.map((item) => ({ year: item }))
  };
}

function buildLetterCondition(rawLetter) {
  const letterValue = normalizeFilterValue(rawLetter).toUpperCase();
  if (!letterValue) return null;

  if (letterValue === '0-9') {
    return { letter: /^[0-9]$/ };
  }

  return { letter: letterValue };
}

function buildVodShowFilter(params = {}, typeContext = {}) {
  const filter = { status: 1 };
  const currentTypeId = typeContext.currentType?._id ?? params.id;

  if (params.id) {
    filter.type = typeContext.filterTypeIds?.length
      ? { $in: typeContext.filterTypeIds }
      : currentTypeId;
  }

  const andConditions = [
    buildExactOrRegexCondition('area', params.area, { aliases: expandAreaAliases(params.area) }),
    buildYearCondition(params.year),
    buildLetterCondition(params.letter),
    buildExactOrRegexCondition('class', params.class),
    buildExactOrRegexCondition('lang', params.lang)
  ].filter(Boolean);

  if (andConditions.length) {
    filter.$and = andConditions;
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

function mergeTypeExtends(types) {
  const source = Array.isArray(types) ? types : [];
  return {
    areas: dedupeValues(source.flatMap((item) => splitFilterValues(item?.extend?.area))),
    years: dedupeValues(source.flatMap((item) => splitFilterValues(item?.extend?.year))),
    classes: dedupeValues(source.flatMap((item) => splitFilterValues(item?.extend?.class))),
    langs: dedupeValues(source.flatMap((item) => splitFilterValues(item?.extend?.lang)))
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
  const roots = (types || []).filter((item) => item && item.status !== false && !hasValue(item.pid));
  const preferred = CANONICAL_ROOT_NAMES
    .map((name) => pickPreferredType(roots.filter((item) => item.name === name)))
    .filter(Boolean);

  if (preferred.length) return preferred;
  return dedupeByName(roots);
}

function resolveTypeSelection(types, requestedId) {
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
    filterOptions: mergeTypeExtends(rootCandidates),
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
  CANONICAL_ROOT_NAMES,
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

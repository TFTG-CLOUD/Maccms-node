const { clearRuntimeCache, readThroughCache } = require('./runtimeCache');

const FILTER_ALIAS_FIELDS = ['area', 'class', 'lang', 'actor', 'director', 'writer'];
const DEFAULT_FILTER_ALIAS_SETTINGS = {
  groups: {
    area: [
      { canonical: '大陆', aliases: ['中国', '中国大陆', '内地', '国产', 'Mainland', 'MainlandChina', '中国大陆MainlandChina'] },
      { canonical: '中国香港', aliases: ['香港', '港区', 'Hong Kong', 'HongKong'] },
      { canonical: '中国台湾', aliases: ['台湾', '台区', 'Taiwan'] },
      { canonical: '中国澳门', aliases: ['澳门', 'Macau', 'Macao'] },
      { canonical: '美国', aliases: ['USA', 'U.S.A', 'United States'] },
      { canonical: '韩国', aliases: ['South Korea', 'SouthKorea', 'Korea'] },
      { canonical: '日本', aliases: ['Japan'] },
      { canonical: '英国', aliases: ['UK', '英國UK'] },
      { canonical: '俄罗斯', aliases: ['俄国', 'Russia'] },
      { canonical: '加拿大', aliases: ['Canada', '加拿大Canada'] },
      { canonical: '法国', aliases: ['France'] },
      { canonical: '德国', aliases: ['Germany'] },
      { canonical: '意大利', aliases: ['Italy'] },
      { canonical: '西班牙', aliases: ['Spain'] },
      { canonical: '澳大利亚', aliases: ['Australia', '澳大利亚Australia'] },
      { canonical: '新加坡', aliases: ['Singapore', '新加坡Singapore'] },
      { canonical: '马来西亚', aliases: ['Malaysia'] },
      { canonical: '印度', aliases: ['India', '印度India'] },
      { canonical: '泰国', aliases: ['Thailand'] },
      { canonical: '印度尼西亚', aliases: ['Indonesia', '印尼'] },
      { canonical: '荷兰', aliases: ['Netherlands', '荷兰Netherlands'] },
      { canonical: '奥地利', aliases: ['Austria', '奥地利Austria'] },
      { canonical: '其它', aliases: ['其他'] }
    ],
    class: [
      { canonical: '剧情', aliases: ['剧情片', 'Drama'] },
      { canonical: '喜剧', aliases: ['喜剧片', 'Comedy'] },
      { canonical: '动作', aliases: ['动作片', 'Action'] },
      { canonical: '爱情', aliases: ['爱情片', 'Romance'] },
      { canonical: '科幻', aliases: ['科幻片', 'Sci-Fi', 'Science', 'Fiction'] },
      { canonical: '恐怖', aliases: ['恐怖片', 'Horror'] },
      { canonical: '悬疑', aliases: ['悬疑片', 'Mystery'] },
      { canonical: '犯罪', aliases: ['犯罪片', 'Crime'] },
      { canonical: '战争', aliases: ['战争片', 'War'] },
      { canonical: '奇幻', aliases: ['奇幻片', 'Fantasy'] },
      { canonical: '动画', aliases: ['动画片'] },
      { canonical: '纪录片', aliases: ['纪录', '记录', '紀錄片', 'Documentary'] }
    ],
    lang: [],
    actor: [],
    director: [],
    writer: []
  }
};

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
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

function splitKeywordTerms(value) {
  if (Array.isArray(value)) {
    return dedupeStrings(value.map((item) => decodeUnicodeText(String(item || '').trim())));
  }
  return dedupeStrings(
    String(value || '')
      .split(/[\s,，/、|;；]+/)
      .map((item) => decodeUnicodeText(item.trim()))
      .filter(Boolean)
  );
}

function normalizeAliasEntry(entry = {}) {
  const canonical = String(entry.canonical || '').trim();
  if (!canonical) return null;
  return {
    canonical,
    aliases: dedupeStrings([canonical, ...(entry.aliases || [])])
  };
}

function normalizeFilterAliasSettings(setting = {}) {
  const groups = setting.groups && typeof setting.groups === 'object' ? setting.groups : {};
  const normalizedGroups = {};

  for (const field of FILTER_ALIAS_FIELDS) {
    normalizedGroups[field] = (groups[field] || [])
      .map((entry) => normalizeAliasEntry(entry))
      .filter(Boolean);
  }

  return {
    groups: normalizedGroups
  };
}

function mergeFilterAliasSettings(storedSetting) {
  const merged = {
    groups: {}
  };
  const defaults = normalizeFilterAliasSettings(DEFAULT_FILTER_ALIAS_SETTINGS);
  const stored = normalizeFilterAliasSettings(storedSetting || {});

  for (const field of FILTER_ALIAS_FIELDS) {
    const map = new Map();
    for (const entry of [...defaults.groups[field], ...stored.groups[field]]) {
      map.set(entry.canonical, entry);
    }
    merged.groups[field] = [...map.values()];
  }

  return merged;
}

function buildAliasLookup(setting = {}) {
  const normalized = mergeFilterAliasSettings(setting);
  const lookup = {};

  for (const field of FILTER_ALIAS_FIELDS) {
    const map = new Map();
    for (const entry of normalized.groups[field]) {
      map.set(entry.canonical, entry.canonical);
      for (const alias of entry.aliases) {
        map.set(alias, entry.canonical);
      }
    }
    lookup[field] = map;
  }

  return lookup;
}

function normalizeKeywordList(field, value, aliasLookup = {}) {
  const fieldLookup = aliasLookup[field] instanceof Map ? aliasLookup[field] : new Map();
  return dedupeStrings(
    splitKeywordTerms(value).map((item) => fieldLookup.get(item) || item)
  );
}

function normalizeTypeExtendForStorage(extend = {}, aliasLookup = {}) {
  return {
    area: normalizeKeywordList('area', extend.area, aliasLookup).join(','),
    year: dedupeStrings(splitKeywordTerms(extend.year)).join(','),
    class: normalizeKeywordList('class', extend.class, aliasLookup).join(','),
    lang: normalizeKeywordList('lang', extend.lang, aliasLookup).join(',')
  };
}

function applyVodFilterMetadata(vod = {}, aliasLookup = {}) {
  return {
    ...vod,
    ...buildVodFilterMetadata(vod, aliasLookup)
  };
}

function stringifyAliasSettingsForForm(setting = {}) {
  const normalized = mergeFilterAliasSettings(setting);
  const result = {};

  for (const field of FILTER_ALIAS_FIELDS) {
    result[field] = (normalized.groups[field] || [])
      .map((entry) => {
        const aliases = dedupeStrings((entry.aliases || []).filter((alias) => alias !== entry.canonical));
        return aliases.length > 0
          ? `${entry.canonical} = ${aliases.join(',')}`
          : entry.canonical;
      })
      .join('\n');
  }

  return result;
}

function parseAliasSettingsFromForm(body = {}) {
  const groups = {};

  for (const field of FILTER_ALIAS_FIELDS) {
    const rawText = String(body?.[field] || '').trim();
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    groups[field] = lines
      .map((line) => {
        const [canonicalPart, aliasPart = ''] = line.split('=');
        const canonical = String(canonicalPart || '').trim();
        if (!canonical) return null;
        return {
          canonical,
          aliases: dedupeStrings([canonical, ...splitKeywordTerms(aliasPart)])
        };
      })
      .filter(Boolean);
  }

  return normalizeFilterAliasSettings({ groups });
}

function buildVodFilterMetadata(vod = {}, aliasLookup = {}) {
  const areaTokens = normalizeKeywordList('area', vod.area, aliasLookup);
  const classTokens = normalizeKeywordList('class', vod.class, aliasLookup);
  const langTokens = normalizeKeywordList('lang', vod.lang, aliasLookup);
  const actorTokens = normalizeKeywordList('actor', vod.actor, aliasLookup);
  const directorTokens = normalizeKeywordList('director', vod.director, aliasLookup);
  const writerTokens = normalizeKeywordList('writer', vod.writer, aliasLookup);
  const yearValue = String(vod.year || '').trim();

  const filterTokens = dedupeStrings([
    ...areaTokens.map((item) => `area:${item}`),
    ...classTokens.map((item) => `class:${item}`),
    ...langTokens.map((item) => `lang:${item}`),
    ...actorTokens.map((item) => `actor:${item}`),
    ...directorTokens.map((item) => `director:${item}`),
    ...writerTokens.map((item) => `writer:${item}`),
    yearValue ? `year:${yearValue}` : ''
  ]);

  return {
    areaTokens,
    classTokens,
    langTokens,
    actorTokens,
    directorTokens,
    writerTokens,
    filterTokens
  };
}

async function getFilterAliasSettings(FilterAliasSettingModel, options = {}) {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  return readThroughCache('filter-alias:settings', ttlMs, async () => {
    const setting = await FilterAliasSettingModel.findOne({ key: 'default' }).lean();
    return mergeFilterAliasSettings(setting);
  }, options);
}

async function clearFilterAliasSettingsCache() {
  await clearRuntimeCache('filter-alias:');
}

module.exports = {
  applyVodFilterMetadata,
  FILTER_ALIAS_FIELDS,
  DEFAULT_FILTER_ALIAS_SETTINGS,
  buildAliasLookup,
  buildVodFilterMetadata,
  clearFilterAliasSettingsCache,
  getFilterAliasSettings,
  mergeFilterAliasSettings,
  normalizeFilterAliasSettings,
  normalizeKeywordList,
  normalizeTypeExtendForStorage,
  parseAliasSettingsFromForm,
  splitKeywordTerms,
  stringifyAliasSettingsForForm
};

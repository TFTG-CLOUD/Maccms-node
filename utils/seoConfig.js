const { clearRuntimeCache, readThroughCache } = require('./runtimeCache');

const DEFAULT_SEO_SETTINGS = {
  index: {
    title: '{siteTitle}',
    keywords: '{siteKeywords}',
    description: '{siteDescription}'
  },
  vod: {
    title: '{vod_name} - {siteName}',
    keywords: '{vod_name},{vod_actor},{siteName}',
    description: '{vod_name}在线观看，由{vod_actor}主演，{vod_content}'
  },
  play: {
    title: '{vod_name} {player_name} {episode_name} - {siteName}',
    keywords: '{vod_name},{player_name},{episode_name},{siteKeywords}',
    description: '{vod_name}正在播放{episode_name}，当前线路：{player_name}。{vod_content}'
  },
  show: {
    title: '{type_name}筛选 - {siteName}',
    keywords: '{type_name},{siteKeywords}',
    description: '{type_name}筛选结果页，支持按地区、年份、字母和排序浏览。'
  },
  type: {
    title: '{type_name} - {siteName}',
    keywords: '{type_name},{siteKeywords}',
    description: '{type_name}分类内容列表。'
  },
  search: {
    title: '{search_word} 搜索结果 - {siteName}',
    keywords: '{search_word},{siteKeywords}',
    description: '{search_word}相关的搜索结果页。'
  },
  art: {
    title: '{art_name} - {siteName}',
    keywords: '{art_name},{siteName}',
    description: '{art_name} - {art_content|mb_substr=0,100}'
  },
  actor: {
    title: '{siteTitle} - 演员',
    keywords: '{siteKeywords}',
    description: '演员首页'
  },
  role: {
    title: '{siteTitle} - 角色',
    keywords: '{siteKeywords}',
    description: '角色首页'
  },
  plot: {
    title: '{siteTitle} - 剧情',
    keywords: '{siteKeywords}',
    description: '剧情首页'
  },
  website: {
    title: '{siteTitle} - 网址',
    keywords: '{siteKeywords}',
    description: '网址首页'
  }
};

function mergeSeoSettings(defaultSettings, storedSettings) {
  const pages = storedSettings?.pages || {};
  const merged = {};

  for (const [pageKey, pageDefaults] of Object.entries(defaultSettings)) {
    merged[pageKey] = {
      ...pageDefaults,
      ...(pages[pageKey] || {})
    };
  }

  return merged;
}

async function getSeoSettings(SeoSettingModel, options = {}) {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  return readThroughCache('seo:settings', ttlMs, async () => {
    const setting = await SeoSettingModel.findOne({ key: 'default' }).lean();
    return mergeSeoSettings(DEFAULT_SEO_SETTINGS, setting);
  }, options);
}

async function clearSeoSettingsCache() {
  await clearRuntimeCache('seo:');
}

module.exports = {
  DEFAULT_SEO_SETTINGS,
  clearSeoSettingsCache,
  getSeoSettings,
  mergeSeoSettings
};

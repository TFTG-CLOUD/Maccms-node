const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_SEO_SETTINGS,
  mergeSeoSettings
} = require('../utils/seoConfig');

test('mergeSeoSettings keeps defaults when database settings are missing', () => {
  const merged = mergeSeoSettings(DEFAULT_SEO_SETTINGS, null);

  assert.equal(merged.play.title, DEFAULT_SEO_SETTINGS.play.title);
  assert.equal(merged.index.description, DEFAULT_SEO_SETTINGS.index.description);
});

test('mergeSeoSettings overlays page templates from database settings', () => {
  const merged = mergeSeoSettings(DEFAULT_SEO_SETTINGS, {
    pages: {
      play: {
        title: '{vod_name} {player_name} {episode_name} - {siteName}',
        keywords: '{vod_name},{player_name},{siteKeywords}',
        description: '{vod_name}正在播放{episode_name}'
      },
      search: {
        title: '{search_word} 搜索结果 - {siteName}'
      }
    }
  });

  assert.equal(merged.play.title, '{vod_name} {player_name} {episode_name} - {siteName}');
  assert.equal(merged.play.keywords, '{vod_name},{player_name},{siteKeywords}');
  assert.equal(merged.play.description, '{vod_name}正在播放{episode_name}');
  assert.equal(merged.search.title, '{search_word} 搜索结果 - {siteName}');
  assert.equal(merged.search.keywords, DEFAULT_SEO_SETTINGS.search.keywords);
});

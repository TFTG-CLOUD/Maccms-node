const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAliasLookup,
  normalizeKeywordList,
  normalizeTypeExtendForStorage
} = require('../utils/filterAliasConfig');

test('buildAliasLookup and normalizeKeywordList canonicalize delimited values', () => {
  const lookup = buildAliasLookup({
    groups: {
      area: [
        { canonical: '大陆', aliases: ['中国', '中国大陆', '内地'] }
      ],
      class: [
        { canonical: '动作', aliases: ['动作片'] }
      ],
      actor: [
        { canonical: '张三', aliases: ['张三丰'] }
      ],
      director: [
        { canonical: '王晶', aliases: ['王晶导演'] }
      ],
      writer: [
        { canonical: '刘慈欣', aliases: ['大刘'] }
      ],
      lang: [
        { canonical: '国语', aliases: ['普通话', '中文'] }
      ]
    }
  });

  assert.deepEqual(
    normalizeKeywordList('area', '中国大陆 / 内地, 美国', lookup),
    ['大陆', '美国']
  );
  assert.deepEqual(
    normalizeKeywordList('class', '动作片,喜剧', lookup),
    ['动作', '喜剧']
  );
  assert.deepEqual(
    normalizeKeywordList('lang', '普通话,中文字幕', lookup),
    ['国语', '中文字幕']
  );
  assert.deepEqual(
    normalizeKeywordList('director', '王晶导演 / 其他导演', lookup),
    ['王晶', '其他导演']
  );
  assert.deepEqual(
    normalizeKeywordList('writer', '大刘,编剧B', lookup),
    ['刘慈欣', '编剧B']
  );
});

test('normalizeTypeExtendForStorage rewrites extend strings to canonical comma-separated values', () => {
  const lookup = buildAliasLookup({
    groups: {
      area: [
        { canonical: '大陆', aliases: ['中国大陆', '内地'] }
      ],
      class: [
        { canonical: '动作', aliases: ['动作片'] }
      ],
      lang: [
        { canonical: '国语', aliases: ['普通话'] }
      ]
    }
  });

  assert.deepEqual(
    normalizeTypeExtendForStorage({
      area: '中国大陆,内地,美国',
      year: '2025,2024',
      class: '动作片,喜剧',
      lang: '普通话,中文字幕'
    }, lookup),
    {
      area: '大陆,美国',
      year: '2025,2024',
      class: '动作,喜剧',
      lang: '国语,中文字幕'
    }
  );
});

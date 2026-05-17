const test = require('node:test');
const assert = require('node:assert/strict');

const { getAllTypes, getDefaultFilterAliasSettings, shouldSeedFilterAliases, shouldSeedTypes } = require('../scripts/seed');

test('shouldSeedTypes is opt-in via --with-types', () => {
  assert.equal(shouldSeedTypes([]), false);
  assert.equal(shouldSeedTypes(['--with-types']), true);
  assert.equal(shouldSeedTypes(['--foo', '--with-types']), true);
});

test('shouldSeedFilterAliases is opt-in via --with-filter-alias', () => {
  assert.equal(shouldSeedFilterAliases([]), false);
  assert.equal(shouldSeedFilterAliases(['--with-filter-alias']), true);
  assert.equal(shouldSeedFilterAliases(['--foo', '--with-filter-alias']), true);
});

test('getAllTypes returns parent and child categories with stable ids', () => {
  const types = getAllTypes();
  const ids = new Set(types.map((item) => item._id));

  assert.equal(types.length > 0, true);
  assert.equal(ids.has(20), true);
  assert.equal(ids.has(21), true);
  assert.equal(ids.has(66), true);
  assert.equal(types.find((item) => item._id === 66)?.pid, 21);
});

test('getDefaultFilterAliasSettings aligns area canonical values with backend filter options', () => {
  const setting = getDefaultFilterAliasSettings();
  const areaCanonicals = new Set(setting.groups.area.map((item) => item.canonical));
  const classCanonicals = new Set(setting.groups.class.map((item) => item.canonical));

  assert.equal(areaCanonicals.has('大陆'), true);
  assert.equal(areaCanonicals.has('中国香港'), true);
  assert.equal(areaCanonicals.has('中国台湾'), true);
  assert.equal(areaCanonicals.has('美国'), true);
  assert.equal(areaCanonicals.has('日本'), true);

  assert.equal(classCanonicals.has('剧情'), true);
  assert.equal(classCanonicals.has('动作'), true);
  assert.equal(classCanonicals.has('纪录片'), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { getAllTypes, shouldSeedTypes } = require('../scripts/seed');

test('shouldSeedTypes is opt-in via --with-types', () => {
  assert.equal(shouldSeedTypes([]), false);
  assert.equal(shouldSeedTypes(['--with-types']), true);
  assert.equal(shouldSeedTypes(['--foo', '--with-types']), true);
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

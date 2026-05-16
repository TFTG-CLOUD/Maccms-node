const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveSessionExpiry } = require('../services/MongoSessionStore');

test('resolveSessionExpiry prefers cookie.expires when present', () => {
  const expiresAt = resolveSessionExpiry({
    cookie: {
      expires: '2026-06-01T00:00:00.000Z',
      maxAge: 1000
    }
  }, 30_000, Date.UTC(2026, 4, 16));

  assert.equal(expiresAt.toISOString(), '2026-06-01T00:00:00.000Z');
});

test('resolveSessionExpiry falls back to cookie.maxAge and default ttl', () => {
  const fromMaxAge = resolveSessionExpiry({
    cookie: {
      maxAge: 10_000
    }
  }, 30_000, 1_000);
  assert.equal(fromMaxAge.getTime(), 11_000);

  const fromDefault = resolveSessionExpiry({}, 30_000, 1_000);
  assert.equal(fromDefault.getTime(), 31_000);
});

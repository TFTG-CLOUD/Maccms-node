const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter, getClientIp, getClientIpGroup } = require('../middleware/rateLimit');
const { MemoryRateLimitStore } = require('../services/SharedRateLimitStore');

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    rendered: null,
    headers: {},
    accepts(type) {
      return type === 'json';
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    render(view, locals) {
      this.rendered = { view, locals };
      return this;
    }
  };
}

test('createRateLimiter allows requests until max and then blocks', async () => {
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 2,
    keyGenerator: (req) => req.ip,
    message: 'too many',
    store: new MemoryRateLimitStore('test-short-1')
  });
  let nextCalls = 0;
  const req = {
    ip: '127.0.0.1',
    accepts(type) {
      return type === 'json' ? 'json' : false;
    }
  };

  await limiter(req, createMockRes(), () => { nextCalls++; });
  await limiter(req, createMockRes(), () => { nextCalls++; });

  const blockedRes = createMockRes();
  await limiter(req, blockedRes, () => { nextCalls++; });

  assert.equal(nextCalls, 2);
  assert.equal(blockedRes.statusCode, 429);
  assert.deepEqual(blockedRes.payload, { code: 0, msg: 'too many' });
});

test('getClientIp prefers trusted req.ip and falls back to first forwarded ip', () => {
  assert.equal(getClientIp({ ip: '203.0.113.8', headers: {} }), '203.0.113.8');
  assert.equal(
    getClientIp({ headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.2' } }),
    '198.51.100.9'
  );
});

test('createRateLimiter works with forwarded client ip extraction', async () => {
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 1,
    keyGenerator: (req) => getClientIp(req),
    message: 'too many',
    store: new MemoryRateLimitStore('test-short-2')
  });

  let nextCalls = 0;
  const req = {
    headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.2' },
    accepts(type) {
      return type === 'json' ? 'json' : false;
    }
  };

  await limiter(req, createMockRes(), () => { nextCalls++; });
  const blockedRes = createMockRes();
  await limiter(req, blockedRes, () => { nextCalls++; });

  assert.equal(nextCalls, 1);
  assert.equal(blockedRes.statusCode, 429);
});

test('getClientIpGroup groups ipv4 addresses by /24 subnet', () => {
  assert.equal(getClientIpGroup({ ip: '116.179.33.71', headers: {} }), '116.179.33.0/24');
  assert.equal(getClientIpGroup({ ip: '116.179.33.17', headers: {} }), '116.179.33.0/24');
  assert.equal(getClientIpGroup({ ip: '66.249.74.12', headers: {} }), '66.249.74.0/24');
});

test('createRateLimiter bans a key after long-window threshold is exceeded', async () => {
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 100,
    banWindowMs: 60 * 60 * 1000,
    banMax: 2,
    banDurationMs: 6 * 60 * 60 * 1000,
    keyGenerator: (req) => getClientIpGroup(req),
    message: 'too many',
    banMessage: 'banned',
    store: new MemoryRateLimitStore('test-shared-ban')
  });
  let nextCalls = 0;
  const reqA = {
    ip: '116.179.33.71',
    accepts(type) {
      return type === 'json' ? 'json' : false;
    }
  };
  const reqB = {
    ip: '116.179.33.17',
    accepts(type) {
      return type === 'json' ? 'json' : false;
    }
  };

  await limiter(reqA, createMockRes(), () => { nextCalls++; });
  await limiter(reqB, createMockRes(), () => { nextCalls++; });

  const bannedRes = createMockRes();
  await limiter(reqA, bannedRes, () => { nextCalls++; });

  assert.equal(nextCalls, 2);
  assert.equal(bannedRes.statusCode, 429);
  assert.deepEqual(bannedRes.payload, { code: 0, msg: 'banned' });
});

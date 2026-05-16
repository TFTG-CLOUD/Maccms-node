const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

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

test('createRateLimiter allows requests until max and then blocks', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, keyGenerator: (req) => req.ip, message: 'too many' });
  let nextCalls = 0;
  const req = {
    ip: '127.0.0.1',
    accepts(type) {
      return type === 'json' ? 'json' : false;
    }
  };

  limiter(req, createMockRes(), () => { nextCalls++; });
  limiter(req, createMockRes(), () => { nextCalls++; });

  const blockedRes = createMockRes();
  limiter(req, blockedRes, () => { nextCalls++; });

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

test('createRateLimiter works with forwarded client ip extraction', () => {
  const limiter = createRateLimiter({
    windowMs: 1000,
    max: 1,
    keyGenerator: (req) => getClientIp(req),
    message: 'too many'
  });

  let nextCalls = 0;
  const req = {
    headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.2' },
    accepts(type) {
      return type === 'json' ? 'json' : false;
    }
  };

  limiter(req, createMockRes(), () => { nextCalls++; });
  const blockedRes = createMockRes();
  limiter(req, blockedRes, () => { nextCalls++; });

  assert.equal(nextCalls, 1);
  assert.equal(blockedRes.statusCode, 429);
});

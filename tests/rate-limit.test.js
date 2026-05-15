const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../middleware/rateLimit');

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

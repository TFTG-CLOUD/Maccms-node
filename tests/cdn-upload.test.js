const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildUrl,
  isCdnUploadEnabled,
  uploadBufferToCdn
} = require('../utils/cdnUpload');

test('isCdnUploadEnabled returns true only when both api key and secret exist', () => {
  const originalKey = process.env.CDN_UPLOAD_API_KEY;
  const originalSecret = process.env.CDN_UPLOAD_API_SECRET;

  process.env.CDN_UPLOAD_API_KEY = '';
  process.env.CDN_UPLOAD_API_SECRET = '';
  assert.equal(isCdnUploadEnabled(), false);

  process.env.CDN_UPLOAD_API_KEY = 'demo-key';
  process.env.CDN_UPLOAD_API_SECRET = '';
  assert.equal(isCdnUploadEnabled(), false);

  process.env.CDN_UPLOAD_API_KEY = 'demo-key';
  process.env.CDN_UPLOAD_API_SECRET = 'demo-secret';
  assert.equal(isCdnUploadEnabled(), true);

  process.env.CDN_UPLOAD_API_KEY = originalKey;
  process.env.CDN_UPLOAD_API_SECRET = originalSecret;
});

test('buildUrl prefixes relative upload api path with CDN base url', () => {
  const originalBaseUrl = process.env.CDN_UPLOAD_BASE_URL;
  process.env.CDN_UPLOAD_BASE_URL = 'https://cdn.example.com/';

  assert.equal(buildUrl('/api/upload/test'), 'https://cdn.example.com/api/upload/test');
  assert.equal(buildUrl('https://other.example.com/demo.jpg'), 'https://other.example.com/demo.jpg');

  process.env.CDN_UPLOAD_BASE_URL = originalBaseUrl;
});

test('uploadBufferToCdn uploads through signed url flow and returns public url', async () => {
  const originalKey = process.env.CDN_UPLOAD_API_KEY;
  const originalSecret = process.env.CDN_UPLOAD_API_SECRET;
  const originalBaseUrl = process.env.CDN_UPLOAD_BASE_URL;
  const originalFetch = globalThis.fetch;
  const originalFormData = globalThis.FormData;

  process.env.CDN_UPLOAD_API_KEY = 'demo-key';
  process.env.CDN_UPLOAD_API_SECRET = 'demo-secret';
  process.env.CDN_UPLOAD_BASE_URL = 'https://cdn.example.com';

  class MockFormData {
    constructor() {
      this.entries = [];
    }

    set(name, value, filename) {
      this.entries.push({ name, value, filename });
    }
  }

  const calls = [];
  globalThis.FormData = MockFormData;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).endsWith('/api/upload/generate-signed-url')) {
      return {
        ok: true,
        json: async () => ({
          uploadUrl: '/api/upload/direct/demo-file'
        })
      };
    }

    return {
      ok: true,
      json: async () => ({
        url: 'https://cdn.example.com/internal/demo-file.jpg',
        publicUrl: 'https://img.example.com/demo-file.jpg'
      })
    };
  };

  try {
    const result = await uploadBufferToCdn({
      filename: 'demo-file.jpg',
      buffer: Buffer.from('hello'),
      contentType: 'image/jpeg'
    });

    assert.equal(result, 'https://img.example.com/demo-file.jpg');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://cdn.example.com/api/upload/generate-signed-url');
    assert.equal(calls[1].url, 'https://cdn.example.com/api/upload/direct/demo-file');
    assert.equal(calls[1].options.headers['X-Public-Access'], 'true');
  } finally {
    process.env.CDN_UPLOAD_API_KEY = originalKey;
    process.env.CDN_UPLOAD_API_SECRET = originalSecret;
    process.env.CDN_UPLOAD_BASE_URL = originalBaseUrl;
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalFormData;
  }
});

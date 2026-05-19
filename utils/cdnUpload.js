const { Blob } = require('buffer');

const DEFAULT_BASE_URL = 'https://cdn.wmdb.tv';

function getBaseUrl() {
  return String(process.env.CDN_UPLOAD_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
}

function isCdnUploadEnabled() {
  return Boolean(
    String(process.env.CDN_UPLOAD_API_KEY || '').trim()
    && String(process.env.CDN_UPLOAD_API_SECRET || '').trim()
  );
}

function getApiHeaders(extraHeaders = {}) {
  const apiKey = String(process.env.CDN_UPLOAD_API_KEY || '').trim();
  const apiSecret = String(process.env.CDN_UPLOAD_API_SECRET || '').trim();

  if (!apiKey || !apiSecret) {
    throw new Error('CDN upload credentials are not configured');
  }

  return {
    'X-API-Key': apiKey,
    'X-API-Secret': apiSecret,
    ...extraHeaders
  };
}

function buildUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const baseUrl = getBaseUrl();
  return `${baseUrl}${String(pathOrUrl || '').startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function toBlob(data, contentType) {
  if (data instanceof Blob) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: contentType });
  }
  return new Blob([Buffer.isBuffer(data) ? data : Buffer.from(data)], { type: contentType });
}

async function readJson(response) {
  const payload = await response.json();
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string'
      ? payload.error
      : `Upload request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function getFetchApi() {
  if (typeof fetch !== 'function' || typeof FormData !== 'function') {
    throw new Error('Global fetch/FormData is unavailable in the current Node.js runtime');
  }
  return { fetch: globalThis.fetch, FormData: globalThis.FormData };
}

async function uploadBufferToCdn({ filename, buffer, contentType = 'image/jpeg', expiresIn = 3600, isPublic = true }) {
  const { fetch: fetchImpl, FormData: FormDataImpl } = getFetchApi();

  const signedResponse = await fetchImpl(buildUrl('/api/upload/generate-signed-url'), {
    method: 'POST',
    headers: getApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      filename,
      contentType,
      expiresIn
    })
  });

  const signedPayload = await readJson(signedResponse);
  const formData = new FormDataImpl();
  formData.set('file', toBlob(buffer, contentType), filename);

  const uploadResponse = await fetchImpl(buildUrl(signedPayload.uploadUrl), {
    method: 'POST',
    headers: getApiHeaders(isPublic ? { 'X-Public-Access': 'true' } : {}),
    body: formData
  });

  const uploadedFile = await readJson(uploadResponse);
  return uploadedFile.publicUrl || uploadedFile.url || '';
}

module.exports = {
  buildUrl,
  getBaseUrl,
  isCdnUploadEnabled,
  uploadBufferToCdn
};

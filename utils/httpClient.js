const fetch = require('node-fetch');
const crypto = require('crypto');

class HttpClient {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async get(url, headers = {}) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': this.userAgent, ...headers },
      timeout: 30000
    });
    return res;
  }

  async post(url, body = {}, headers = {}) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'User-Agent': this.userAgent, 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
      body: new URLSearchParams(body).toString(),
      timeout: 30000
    });
    return res;
  }

  md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }
}

module.exports = new HttpClient();

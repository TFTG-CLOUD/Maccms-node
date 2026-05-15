function compressHtml(req, res, next) {
  const originalSend = res.send.bind(res);
  res.send = function(body) {
    if (typeof body === 'string' && res.get('Content-Type')?.includes('text/html')) {
      body = body.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
    }
    return originalSend(body);
  };
  next();
}

module.exports = compressHtml;

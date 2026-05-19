function mergeCacheControl(existingValue = '', directive = 'no-transform') {
  const parts = String(existingValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!parts.includes(directive)) {
    parts.push(directive);
  }

  return parts.join(', ');
}

function antiTransformMiddleware(req, res, next) {
  res.set('Cache-Control', mergeCacheControl(res.get('Cache-Control'), 'no-transform'));
  res.set('X-UA-Compatible', 'IE=edge,chrome=1');
  next();
}

module.exports = {
  antiTransformMiddleware,
  mergeCacheControl
};

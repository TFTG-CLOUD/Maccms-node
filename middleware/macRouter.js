const suffixRe = /\.(html|htm|shtm|shtml|xml)$/i;

function macRouter(req, res, next) {
  const path = req.path;
  req.params = req.params || {};

  const trailingWildcard = req.params[0] || '';

  const parts = [];

  if (trailingWildcard) {
    const cleaned = trailingWildcard
      .replace(suffixRe, '')
      .replace(/\/$/, '');
    parts.push(...cleaned.split('/').filter(Boolean));
  }

  const routeParts = path
    .replace(suffixRe, '')
    .split('/')
    .filter(Boolean);

  const entryIndex = routeParts.indexOf('index.php') + 1 || routeParts.indexOf('api.php') + 1 || routeParts.indexOf('admin.php') + 1 || 0;
  const afterEntry = entryIndex > 0 ? routeParts.slice(entryIndex) : routeParts;

  let controller = req.params.ctr || 'index';
  let action = req.params.act || 'index';

  if (afterEntry.length >= 2) {
    controller = afterEntry[0];
    action = afterEntry[1];
  }

  const allKeyValues = [...(afterEntry.length >= 2 ? afterEntry.slice(2) : afterEntry), ...parts];

  const params = { page: 1 };
  for (let i = 0; i < allKeyValues.length - 1; i += 2) {
    const key = allKeyValues[i];
    const val = allKeyValues[i + 1];
    if (val === undefined) break;
    params[key] = /^\d+$/.test(val) ? parseInt(val, 10) : decodeURIComponent(val);
  }

  if (req.query.wd) params.wd = req.query.wd;
  if (req.query.page) params.page = parseInt(req.query.page, 10);

  req.mac = {
    controller: params.ctr || controller,
    action: params.act || action,
    params
  };

  next();
}

module.exports = macRouter;

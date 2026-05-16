const express = require('express');
const router = express.Router();
const macRouter = require('../middleware/macRouter');
const { capitalize } = require('../utils/helpers');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');
const RssController = require('../controllers/front/RssController');

const searchRateLimiter = createRateLimiter({
  windowMs: Number(process.env.SEARCH_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.SEARCH_RATE_LIMIT_MAX) || 6,
  keyGenerator: (req) => `vod-search:${getClientIp(req)}`,
  message: '搜索过于频繁，请稍后再试'
});

function applySearchRateLimit(req, res, next) {
  if (req.mac?.controller === 'vod' && req.mac?.action === 'search') {
    return searchRateLimiter(req, res, next);
  }
  return next();
}

function dispatch(req, res) {
  const { controller, action, params } = req.mac;
  if (!controller || controller === 'upload' || String(controller).startsWith('.')) {
    return res.status(404).send('Not Found');
  }
  try {
    const Ctrl = require('../controllers/front/' + capitalize(controller) + 'Controller');
    const instance = new Ctrl();
    if (typeof instance[action] === 'function') {
      return instance[action](req, res);
    }
  } catch (e) {
    console.error('Dispatch error:', e.message);
  }
  res.status(404).render('error', { message: '页面不存在' });
}

const rssController = new RssController();
router.get('/robots.txt', (req, res) => rssController.robots(req, res));
router.get('/rss/index.xml', (req, res) => rssController.index(req, res));
router.get('/index.php/rss/index.xml', (req, res) => rssController.index(req, res));

router.get('/index.php/:ctr/:act/*', macRouter, applySearchRateLimit, dispatch);
router.get('/index.php/:ctr/:act', macRouter, applySearchRateLimit, dispatch);
router.get('/:ctr/:act/*', macRouter, applySearchRateLimit, dispatch);
router.get('/:ctr/:act', macRouter, applySearchRateLimit, dispatch);
function homeHandler(req, res) {
  req.mac = { controller: 'index', action: 'index', params: {} };
  dispatch(req, res);
}

router.get('/', homeHandler);
router.get('/index.php', homeHandler);
router.get('/index.php/', homeHandler);

module.exports = router;

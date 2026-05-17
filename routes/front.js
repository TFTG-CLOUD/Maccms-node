const express = require('express');
const router = express.Router();
const macRouter = require('../middleware/macRouter');
const { frontAccessLogMiddleware } = require('../middleware/frontAccessLog');
const { frontContextMiddleware } = require('../middleware/frontContext');
const { createRateLimiter, getClientIpGroup } = require('../middleware/rateLimit');
const RssController = require('../controllers/front/RssController');

const searchRateLimiter = createRateLimiter({
  windowMs: Number(process.env.SEARCH_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.SEARCH_RATE_LIMIT_MAX) || 6,
  banWindowMs: Number(process.env.SEARCH_RATE_LIMIT_BAN_WINDOW_MS) || 60 * 60 * 1000,
  banMax: Number(process.env.SEARCH_RATE_LIMIT_BAN_MAX) || 100,
  banDurationMs: Number(process.env.SEARCH_RATE_LIMIT_BAN_DURATION_MS) || 6 * 60 * 60 * 1000,
  keyGenerator: (req) => `vod-search:${getClientIpGroup(req)}`,
  message: '搜索过于频繁，请稍后再试',
  banMessage: '搜索访问异常频繁，已临时限制'
});

const frontPageRateLimiter = createRateLimiter({
  windowMs: Number(process.env.FRONT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.FRONT_RATE_LIMIT_MAX) || 1000000,
  banWindowMs: Number(process.env.FRONT_RATE_LIMIT_BAN_WINDOW_MS) || 60 * 60 * 1000,
  banMax: Number(process.env.FRONT_RATE_LIMIT_BAN_MAX) || 200,
  banDurationMs: Number(process.env.FRONT_RATE_LIMIT_BAN_DURATION_MS) || 6 * 60 * 60 * 1000,
  keyGenerator: (req) => `front-page:${getClientIpGroup(req)}`,
  message: '访问过于频繁，请稍后再试',
  banMessage: '访问异常频繁，已临时限制'
});

function applySearchRateLimit(req, res, next) {
  if (req.mac?.controller === 'vod' && req.mac?.action === 'search') {
    return searchRateLimiter(req, res, next);
  }
  return next();
}

function applyFrontPageRateLimit(req, res, next) {
  if (req.mac?.controller === 'vod' && req.mac?.action === 'search') {
    return next();
  }
  return frontPageRateLimiter(req, res, next);
}

const controllerLoaders = {
  actor: () => require('../controllers/front/ActorController'),
  art: () => require('../controllers/front/ArtController'),
  index: () => require('../controllers/front/IndexController'),
  rss: () => require('../controllers/front/RssController'),
  topic: () => require('../controllers/front/TopicController'),
  vod: () => require('../controllers/front/VodController')
};
const controllerInstances = new Map();

function getControllerInstance(controller) {
  const existing = controllerInstances.get(controller);
  if (existing) return existing;

  const loadController = controllerLoaders[controller];
  if (!loadController) return null;

  const Controller = loadController();
  const instance = new Controller();
  controllerInstances.set(controller, instance);
  return instance;
}

function dispatch(req, res) {
  const { controller, action, params } = req.mac;
  if (!controller || controller === 'upload' || String(controller).startsWith('.')) {
    return res.status(404).send('Not Found');
  }

  const instance = getControllerInstance(String(controller).toLowerCase());
  if (!instance) {
    return res.status(404).render('error', { message: '页面不存在' });
  }

  if (typeof instance[action] === 'function') {
    try {
      return instance[action](req, res);
    } catch (error) {
      console.error('Dispatch error:', error.message);
    }
  }
  res.status(404).render('error', { message: '页面不存在' });
}

const rssController = new RssController();
router.use(frontAccessLogMiddleware);
router.get('/robots.txt', (req, res) => rssController.robots(req, res));
router.get('/rss/index.xml', (req, res) => rssController.index(req, res));
router.get('/index.php/rss/index.xml', (req, res) => rssController.index(req, res));

router.use(frontContextMiddleware);

router.get('/index.php/:ctr/:act/*', macRouter, applyFrontPageRateLimit, applySearchRateLimit, dispatch);
router.get('/index.php/:ctr/:act', macRouter, applyFrontPageRateLimit, applySearchRateLimit, dispatch);
router.get('/:ctr/:act/*', macRouter, applyFrontPageRateLimit, applySearchRateLimit, dispatch);
router.get('/:ctr/:act', macRouter, applyFrontPageRateLimit, applySearchRateLimit, dispatch);
function homeHandler(req, res) {
  req.mac = { controller: 'index', action: 'index', params: {} };
  return applyFrontPageRateLimit(req, res, () => dispatch(req, res));
}

router.get('/', homeHandler);
router.get('/index.php', homeHandler);
router.get('/index.php/', homeHandler);

module.exports = router;

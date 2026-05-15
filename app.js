require('dotenv').config();
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const flash = require('connect-flash');
const mongoose = require('mongoose');
const path = require('path');
const nodeCron = require('node-cron');
const scheduler = require('./services/Scheduler');

const config = require('./config');
const routes = require('./routes');
const { pageCacheMiddleware } = require('./middleware/pageCache');
const { selectNavTypes } = require('./utils/front');
const { readThroughCache } = require('./utils/runtimeCache');
const { macUrl, stripIndexPhp } = require('./utils/urlHelper');
const SeoSetting = require('./models/SeoSetting');
const { getSeoSettings } = require('./utils/seoConfig');
const AdSetting = require('./models/AdSetting');
const { getAdSettings } = require('./utils/adConfig');
const collectTaskRunner = require('./services/CollectTaskRunner');

const app = express();
const STATIC_CACHE_MAX_AGE = '1d';
const FRONT_NAV_CACHE_TTL_MS = Math.max(1, Number(config.frontNavCacheTime || 600)) * 1000;

app.set('view engine', 'pug');
app.set('views', [
  path.join(__dirname, 'views', config.templateTheme),
  path.join(__dirname, 'views', 'admin'),
  path.join(__dirname, 'views')
]);

app.use(compression());
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use('/upload', express.static(path.join(__dirname, 'public', 'upload'), {
  fallthrough: false,
  maxAge: STATIC_CACHE_MAX_AGE
}));
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), { maxAge: STATIC_CACHE_MAX_AGE }));

if (config.pageCacheStatus) {
  app.use(pageCacheMiddleware);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 86400000 }
}));
app.use(flash());

app.locals.maccms = config;
app.locals.macUrl = macUrl;

app.use(async (req, res, next) => {
  try {
    const Type = require('./models/Type');
    const navData = await readThroughCache('front:nav', FRONT_NAV_CACHE_TTL_MS, async () => {
      const allTypes = await Type.find({ mid: 1, status: true }).sort({ sort: 1 }).lean();
      return {
        allTypes,
        navTypes: selectNavTypes(allTypes)
      };
    });
    const allTypes = Array.isArray(navData.allTypes) ? navData.allTypes : [];
    const types = Array.isArray(navData.navTypes)
      ? navData.navTypes.map((item) => ({ ...item }))
      : [];
    const pathReq = req.path;
    const isIndexPage = pathReq === '/' || pathReq === '/index.php' || /^\/index\.php\/index\/index\/?$/.test(pathReq);
    res.locals.homeActive = isIndexPage;
    types.forEach(t => {
      t.active = pathReq.includes('/vod/show/id/' + t._id) || pathReq.includes('/vod/type/id/' + t._id) || false;
    });
    res.locals.allTypes = allTypes;
    res.locals.types = types;
  } catch(e) {
    res.locals.allTypes = [];
    res.locals.types = [];
    res.locals.homeActive = req.path === '/' || req.path === '/index.php' || /^\/index\.php\/index\/index\/?$/.test(req.path);
  }
  next();
});

app.use(async (req, res, next) => {
  try {
    res.locals.seoSettings = await getSeoSettings(SeoSetting);
  } catch (error) {
    console.error('SEO settings load error:', error.message);
    res.locals.seoSettings = null;
  }
  next();
});

app.use(async (req, res, next) => {
  try {
    res.locals.adSettings = await getAdSettings(AdSetting);
  } catch (error) {
    console.error('Ad settings load error:', error.message);
    res.locals.adSettings = null;
  }
  next();
});

// 301 重定向: clean 模式下将 /index.php/* 永久重定向到 /* (不含 index.php)
if (config.urlMode === 'clean') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/index.php')) {
      const cleanPath = stripIndexPhp(req.path);
      const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      return res.redirect(301, cleanPath + query);
    }
    next();
  });
}

app.use('/', routes);

app.use((err, req, res, next) => {
  if (err && err.status === 404) {
    return res.status(404).send('Not Found');
  }
  console.error(err.stack);
  res.status(500).render('error', { message: '服务器内部错误', error: process.env.NODE_ENV === 'development' ? err : {} });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    await collectTaskRunner.recoverStaleTasks();
    console.log('MongoDB connected');
    app.listen(process.env.PORT, () => {
      console.log(`MacCMS Node running on http://localhost:${process.env.PORT}`);
    });

    if (process.env.ENABLE_CRON !== 'false') {
      nodeCron.schedule('*/30 * * * *', async () => {
        try {
          await scheduler.check();
        } catch (e) {
          console.error('Cron error:', e.message);
        }
      });
      console.log('Cron scheduler started (every 30 min)');
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;

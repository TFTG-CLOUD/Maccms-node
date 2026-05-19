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
const { frontCounterMiddleware } = require('./middleware/frontCounters');
const { pageCacheMiddleware } = require('./middleware/pageCache');
const { macUrl, stripIndexPhp } = require('./utils/urlHelper');
const collectTaskRunner = require('./services/CollectTaskRunner');
const { MongoSessionStore } = require('./services/MongoSessionStore');

const app = express();
const STATIC_CACHE_MAX_AGE = '1d';
const ADMIN_SESSION_MAX_AGE_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.ADMIN_SESSION_MAX_AGE_MS) || 30 * 24 * 60 * 60 * 1000
);
const TRUST_PROXY = process.env.TRUST_PROXY;
const CRON_PRIMARY_ONLY = process.env.CRON_PRIMARY_ONLY !== 'false';
const ENABLE_HTTP_COMPRESSION = process.env.ENABLE_HTTP_COMPRESSION === 'true';

function shouldStartCronScheduler() {
  if (process.env.ENABLE_CRON === 'false') return false;
  if (!CRON_PRIMARY_ONLY) return true;

  const instanceId = process.env.NODE_APP_INSTANCE;
  if (instanceId === undefined || instanceId === '') return true;
  return String(instanceId) === '0';
}

if (TRUST_PROXY !== undefined && TRUST_PROXY !== '') {
  if (TRUST_PROXY === 'true') {
    app.set('trust proxy', true);
  } else if (TRUST_PROXY === 'false') {
    app.set('trust proxy', false);
  } else if (/^\d+$/.test(TRUST_PROXY)) {
    app.set('trust proxy', Number(TRUST_PROXY));
  } else {
    app.set('trust proxy', TRUST_PROXY);
  }
}

app.set('view engine', 'pug');
app.set('views', [
  path.join(__dirname, 'views', config.templateTheme),
  path.join(__dirname, 'views', 'admin'),
  path.join(__dirname, 'views')
]);

if (ENABLE_HTTP_COMPRESSION) {
  app.use(compression());
}
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use('/img', express.static(path.join(__dirname, 'public', 'img'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use('/upload', express.static(path.join(__dirname, 'public', 'upload'), {
  fallthrough: false,
  maxAge: STATIC_CACHE_MAX_AGE
}));
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use('/images', express.static(path.join(__dirname, 'public', 'images'), { maxAge: STATIC_CACHE_MAX_AGE }));
app.use(frontCounterMiddleware);

if (config.pageCacheStatus) {
  app.use(pageCacheMiddleware);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'maccms.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: new MongoSessionStore({ ttlMs: ADMIN_SESSION_MAX_AGE_MS }),
  cookie: {
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(flash());

app.locals.maccms = config;
app.locals.macUrl = macUrl;

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

    if (shouldStartCronScheduler()) {
      nodeCron.schedule('*/30 * * * *', async () => {
        try {
          await scheduler.check();
        } catch (e) {
          console.error('Cron error:', e.message);
        }
      });
      console.log('Cron scheduler started (every 30 min)');
    } else {
      console.log('Cron scheduler skipped for this process');
    }

    if (!ENABLE_HTTP_COMPRESSION) {
      console.log('HTTP compression disabled in Node; rely on reverse proxy/CDN compression if available');
    }
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;

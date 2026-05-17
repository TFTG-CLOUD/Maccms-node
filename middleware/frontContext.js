const config = require('../config');
const { selectNavTypes } = require('../utils/front');
const { readThroughCache } = require('../utils/runtimeCache');
const SeoSetting = require('../models/SeoSetting');
const { getSeoSettings } = require('../utils/seoConfig');
const AdSetting = require('../models/AdSetting');
const { getAdSettings } = require('../utils/adConfig');
const FilterAliasSetting = require('../models/FilterAliasSetting');
const { buildAliasLookup, getFilterAliasSettings } = require('../utils/filterAliasConfig');

const FRONT_NAV_CACHE_TTL_MS = Math.max(1, Number(config.frontNavCacheTime || 600)) * 1000;

async function loadFrontNavContext(req, res, next) {
  try {
    const Type = require('../models/Type');
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
    types.forEach((t) => {
      t.active = pathReq.includes('/vod/show/id/' + t._id) || pathReq.includes('/vod/type/id/' + t._id) || false;
    });
    res.locals.allTypes = allTypes;
    res.locals.types = types;
  } catch (error) {
    res.locals.allTypes = [];
    res.locals.types = [];
    res.locals.homeActive = req.path === '/' || req.path === '/index.php' || /^\/index\.php\/index\/index\/?$/.test(req.path);
  }
  next();
}

async function loadSeoSettingsContext(req, res, next) {
  try {
    res.locals.seoSettings = await getSeoSettings(SeoSetting);
  } catch (error) {
    console.error('SEO settings load error:', error.message);
    res.locals.seoSettings = null;
  }
  next();
}

async function loadAdSettingsContext(req, res, next) {
  try {
    res.locals.adSettings = await getAdSettings(AdSetting);
  } catch (error) {
    console.error('Ad settings load error:', error.message);
    res.locals.adSettings = null;
  }
  next();
}

async function loadFilterAliasContext(req, res, next) {
  try {
    const filterAliasSettings = await getFilterAliasSettings(FilterAliasSetting);
    res.locals.filterAliasSettings = filterAliasSettings;
    res.locals.filterAliasLookup = buildAliasLookup(filterAliasSettings);
  } catch (error) {
    console.error('Filter alias settings load error:', error.message);
    res.locals.filterAliasSettings = null;
    res.locals.filterAliasLookup = buildAliasLookup();
  }
  next();
}

module.exports = {
  frontContextMiddleware: [
    loadFrontNavContext,
    loadSeoSettingsContext,
    loadAdSettingsContext,
    loadFilterAliasContext
  ]
};

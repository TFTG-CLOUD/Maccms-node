const { clearRuntimeCache, readThroughCache } = require('./runtimeCache');

const DEFAULT_AD_SETTINGS = {
  playMetaText: {
    enabled: false,
    html: ''
  },
  playBetweenBanner: {
    enabled: false,
    image: '',
    link: '',
    alt: '',
    width: 0,
    height: 0,
    openInNewTab: true
  }
};

function sanitizeAdminHtml(html) {
  return String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\s(href|src)=("|\')\s*javascript:[^"\']*\2/gi, ' $1="#"');
}

function sanitizeLink(link) {
  const value = String(link || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return '';
}

function normalizeAdSettings(setting) {
  const slots = setting?.slots || {};
  const banner = slots.playBetweenBanner || {};
  const width = Math.max(0, Number(banner.width) || 0);
  const height = Math.max(0, Number(banner.height) || 0);

  return {
    playMetaText: {
      enabled: Boolean(slots.playMetaText?.enabled),
      html: sanitizeAdminHtml(slots.playMetaText?.html || '')
    },
    playBetweenBanner: {
      enabled: Boolean(banner.enabled),
      image: String(banner.image || '').trim(),
      link: sanitizeLink(banner.link),
      alt: String(banner.alt || '').trim(),
      width,
      height,
      aspectRatio: width > 0 && height > 0 ? `${width} / ${height}` : '',
      openInNewTab: banner.openInNewTab !== false
    }
  };
}

function mergeAdSettings(defaultSettings, storedSettings) {
  return normalizeAdSettings({
    slots: {
      ...defaultSettings,
      ...(storedSettings?.slots || {})
    }
  });
}

async function getAdSettings(AdSettingModel, options = {}) {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  return readThroughCache('ad:settings', ttlMs, async () => {
    const setting = await AdSettingModel.findOne({ key: 'default' }).lean();
    return mergeAdSettings(DEFAULT_AD_SETTINGS, setting);
  }, options);
}

async function clearAdSettingsCache() {
  await clearRuntimeCache('ad:');
}

module.exports = {
  DEFAULT_AD_SETTINGS,
  clearAdSettingsCache,
  getAdSettings,
  mergeAdSettings,
  normalizeAdSettings,
  sanitizeAdminHtml,
  sanitizeLink
};

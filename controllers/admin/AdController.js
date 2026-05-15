const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const AdSetting = require('../../models/AdSetting');
const { DEFAULT_AD_SETTINGS, mergeAdSettings, clearAdSettingsCache, sanitizeAdminHtml, sanitizeLink } = require('../../utils/adConfig');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'upload', 'ad');
const MIME_EXT_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg'
};

function toBool(value) {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

function toPositiveInt(value) {
  return Math.max(0, parseInt(value, 10) || 0);
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function saveBannerImage(dataUrl, originalName) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return '';

  const [, mimeType, base64Payload] = match;
  const ext = MIME_EXT_MAP[mimeType];
  if (!ext) return '';

  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer.length) return '';

  ensureUploadDir();
  const safeBase = String(originalName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'ad-banner';
  const filename = `${Date.now()}-${safeBase}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/upload/ad/${filename}`;
}

class AdController {
  async index(req, res) {
    const setting = await AdSetting.findOne({ key: 'default' }).lean();
    res.render('ad/index', {
      setting: mergeAdSettings(DEFAULT_AD_SETTINGS, setting),
      defaults: DEFAULT_AD_SETTINGS
    });
  }

  async update(req, res) {
    const current = await AdSetting.findOne({ key: 'default' }).lean();
    const currentBanner = current?.slots?.playBetweenBanner || {};

    let bannerImage = String(req.body.play_between_banner_current_image || currentBanner.image || '').trim();
    if (toBool(req.body.play_between_banner_remove_image)) {
      bannerImage = '';
    }

    if (req.body.play_between_banner_image_data) {
      const uploaded = saveBannerImage(
        req.body.play_between_banner_image_data,
        req.body.play_between_banner_image_name
      );
      if (uploaded) {
        bannerImage = uploaded;
      }
    }

    const slots = {
      playMetaText: {
        enabled: toBool(req.body.play_meta_text_enabled),
        html: sanitizeAdminHtml(req.body.play_meta_text_html)
      },
      playBetweenBanner: {
        enabled: toBool(req.body.play_between_banner_enabled),
        image: bannerImage,
        link: sanitizeLink(req.body.play_between_banner_link),
        alt: String(req.body.play_between_banner_alt || '').trim(),
        width: bannerImage ? toPositiveInt(req.body.play_between_banner_width) : 0,
        height: bannerImage ? toPositiveInt(req.body.play_between_banner_height) : 0,
        openInNewTab: toBool(req.body.play_between_banner_open_in_new_tab || '1')
      }
    };

    await AdSetting.findOneAndUpdate(
      { key: 'default' },
      { $set: { key: 'default', slots } },
      { upsert: true }
    );

    clearAdSettingsCache();
    res.redirect('/admin/ad');
  }
}

module.exports = AdController;

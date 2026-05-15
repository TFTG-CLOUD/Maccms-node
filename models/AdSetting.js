const mongoose = require('mongoose');

const playMetaTextSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  html: { type: String, default: '' }
}, { _id: false });

const playBetweenBannerSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  image: { type: String, default: '' },
  link: { type: String, default: '' },
  alt: { type: String, default: '' },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  openInNewTab: { type: Boolean, default: true }
}, { _id: false });

const adSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  slots: {
    playMetaText: { type: playMetaTextSchema, default: () => ({}) },
    playBetweenBanner: { type: playBetweenBannerSchema, default: () => ({}) }
  }
}, { timestamps: true });

module.exports = mongoose.model('AdSetting', adSettingSchema);

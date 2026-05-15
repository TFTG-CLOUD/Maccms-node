const mongoose = require('mongoose');

const seoPageSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  keywords: { type: String, default: '' },
  description: { type: String, default: '' }
}, { _id: false });

const seoSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  pages: {
    index: { type: seoPageSchema, default: () => ({}) },
    vod: { type: seoPageSchema, default: () => ({}) },
    play: { type: seoPageSchema, default: () => ({}) },
    show: { type: seoPageSchema, default: () => ({}) },
    type: { type: seoPageSchema, default: () => ({}) },
    search: { type: seoPageSchema, default: () => ({}) },
    art: { type: seoPageSchema, default: () => ({}) },
    actor: { type: seoPageSchema, default: () => ({}) },
    role: { type: seoPageSchema, default: () => ({}) },
    plot: { type: seoPageSchema, default: () => ({}) },
    website: { type: seoPageSchema, default: () => ({}) }
  }
}, { timestamps: true });

module.exports = mongoose.model('SeoSetting', seoSettingSchema);

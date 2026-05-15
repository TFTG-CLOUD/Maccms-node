const mongoose = require('mongoose');

const scraperRuleSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  sourceType:  { type: String, enum: ['regex', 'css'], default: 'css' },
  urlTemplate: { type: String, default: '' },
  pageStart:   { type: Number, default: 1 },
  pageEnd:     { type: Number, default: 1 },
  rules: {
    listItem:   { type: String, default: '' },
    title:      { type: String, default: '' },
    detailUrl:  { type: String, default: '' },
    content:    { type: String, default: '' },
    pic:        { type: String, default: '' },
    type:       { type: String, default: '' },
    year:       { type: String, default: '' },
    area:       { type: String, default: '' },
    actor:      { type: String, default: '' },
    director:   { type: String, default: '' },
    playUrls:   { type: String, default: '' },
    extendRules:{ type: mongoose.Schema.Types.Mixed, default: {} }
  },
  mid:          { type: Number, default: 1 },
  urlFilter:    {
    include:    { type: String, default: '' },
    exclude:    { type: String, default: '' }
  },
  status:       { type: Boolean, default: true }
}, { timestamps: true });
module.exports = mongoose.model('ScraperRule', scraperRuleSchema);

const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  type:       { type: mongoose.Schema.Types.ObjectId, ref: 'Type' },
  name:       { type: String, required: true },
  en:         { type: String, default: '' },
  url:        { type: String, default: '' },
  logo:       { type: String, default: '' },
  content:    { type: String, default: '' },
  referer:    { type: String, default: '' },
  hits:       { type: Number, default: 0 },
  status:     { type: Number, default: 0 },
  level:      { type: Number, default: 0 },
  color:      { type: String, default: '' },
  letter:     { type: String, default: '' }
}, { timestamps: true });
websiteSchema.index({ type: 1 });
module.exports = mongoose.model('Website', websiteSchema);

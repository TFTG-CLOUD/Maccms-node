const mongoose = require('mongoose');

const typeSchema = new mongoose.Schema({
  _id:      { type: mongoose.Schema.Types.Mixed },
  name:     { type: String, required: true },
  en:       { type: String, default: '' },
  mid:      { type: Number, default: 1 },
  pid:      { type: mongoose.Schema.Types.Mixed, ref: 'Type', default: null },
  sort:     { type: Number, default: 0 },
  status:   { type: Boolean, default: true },
  tpl:      { type: String, default: '' },
  tplDetail:{ type: String, default: '' },
  tplPlay:  { type: String, default: '' },
  tplDown:  { type: String, default: '' },
  logo:     { type: String, default: '' },
  extend:   { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

typeSchema.index({ mid: 1, status: 1 });
typeSchema.index({ pid: 1 });

module.exports = mongoose.model('Type', typeSchema);

const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema({
  type:       { type: mongoose.Schema.Types.ObjectId, ref: 'Type' },
  name:       { type: String, required: true },
  en:         { type: String, default: '' },
  sex:        { type: String, default: '' },
  area:       { type: String, default: '' },
  height:     { type: String, default: '' },
  weight:     { type: String, default: '' },
  birthday:   { type: String, default: '' },
  blood:      { type: String, default: '' },
  starsign:   { type: String, default: '' },
  school:     { type: String, default: '' },
  works:      { type: String, default: '' },
  pic:        { type: String, default: '' },
  content:    { type: String, default: '' },
  hits:       { type: Number, default: 0 },
  status:     { type: Number, default: 0 },
  level:      { type: Number, default: 0 },
  color:      { type: String, default: '' },
  letter:     { type: String, default: '' },
  tpl:        { type: String, default: '' }
}, { timestamps: true });
actorSchema.index({ name: 1 });
actorSchema.index({ area: 1, sex: 1 });
module.exports = mongoose.model('Actor', actorSchema);

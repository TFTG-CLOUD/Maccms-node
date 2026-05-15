const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  en:         { type: String, default: '' },
  sub:        { type: String, default: '' },
  pic:        { type: String, default: '' },
  content:    { type: String, default: '' },
  relVods:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vod' }],
  relArts:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Art' }],
  hits:       { type: Number, default: 0 },
  status:     { type: Number, default: 0 },
  level:      { type: Number, default: 0 },
  color:      { type: String, default: '' },
  tpl:        { type: String, default: '' }
}, { timestamps: true });
topicSchema.index({ name: 1 });
module.exports = mongoose.model('Topic', topicSchema);

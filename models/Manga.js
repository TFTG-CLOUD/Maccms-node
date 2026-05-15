const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  nid:  Number,
  name: String,
  urls: [String]
}, { _id: false });

const mangaSchema = new mongoose.Schema({
  type:          { type: mongoose.Schema.Types.ObjectId, ref: 'Type' },
  name:          { type: String, required: true },
  en:            { type: String, default: '' },
  author:        { type: String, default: '' },
  pic:           { type: String, default: '' },
  content:       { type: String, default: '' },
  chapters:      [chapterSchema],
  total:         { type: Number, default: 0 },
  serial:        { type: String, default: '' },
  isEnd:         { type: Boolean, default: false },
  lastUpdateTime:{ type: Date },
  ageRating:     { type: String, default: '' },
  hits:          { type: Number, default: 0 },
  score:         { type: Number, default: 0 },
  status:        { type: Number, default: 0 },
  tpl:           { type: String, default: '' }
}, { timestamps: true });
mangaSchema.index({ type: 1, status: 1 });
module.exports = mongoose.model('Manga', mangaSchema);

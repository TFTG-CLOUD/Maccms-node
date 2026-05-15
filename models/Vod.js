const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema({
  nid:  Number,
  name: String,
  url:  String
}, { _id: false });

const playServerSchema = new mongoose.Schema({
  server:   String,
  episodes: [episodeSchema]
}, { _id: false });

const vodSchema = new mongoose.Schema({
  _id:          { type: mongoose.Schema.Types.Mixed },
  name:         { type: String, required: true },
  en:           { type: String, default: '' },
  sub:          { type: String, default: '' },
  type:         { type: mongoose.Schema.Types.Mixed, ref: 'Type' },
  typeExtend:   { type: mongoose.Schema.Types.Mixed, default: {} },
  actor:        { type: String, default: '' },
  director:     { type: String, default: '' },
  writer:       { type: String, default: '' },
  pic:          { type: String, default: '' },
  content:      { type: String, default: '' },
  playUrls:     [playServerSchema],
  downUrls:     [playServerSchema],
  year:         { type: mongoose.Schema.Types.Mixed, default: '' },
  area:         { type: String, default: '' },
  lang:         { type: String, default: '' },
  class:        { type: String, default: '' },
  tags:         [{ type: String }],
  total:        { type: Number, default: 0 },
  serial:       { type: String, default: '' },
  isEnd:        { type: Boolean, default: false },
  status:       { type: Number, default: 0 },
  lock:         { type: Number, default: 0 },
  level:        { type: Number, default: 0 },
  copyright:    { type: Number, default: 0 },
  hits:         { type: Number, default: 0 },
  hitsDay:      { type: Number, default: 0 },
  hitsWeek:     { type: Number, default: 0 },
  hitsMonth:    { type: Number, default: 0 },
  score:        { type: Number, default: 0 },
  scoreAll:     { type: Number, default: 0 },
  scoreNum:     { type: Number, default: 0 },
  doubanScore:  { type: Number, default: 0 },
  doubanId:     { type: String, default: '' },
  tpl:          { type: String, default: '' },
  tplPlay:      { type: String, default: '' },
  tplDown:      { type: String, default: '' },
  recycleTime:  { type: Number, default: 0 },
  trysee:       { type: Number, default: 0 },
  pwd:          { type: String, default: '' },
  playPwd:      { type: String, default: '' },
  downPwd:      { type: String, default: '' },
  points:       { type: Number, default: 0 },
  pointsPlay:   { type: Number, default: 0 },
  pointsDown:   { type: Number, default: 0 },
  relVods:      [{ type: mongoose.Schema.Types.Mixed, ref: 'Vod' }],
  relArts:      [{ type: mongoose.Schema.Types.Mixed, ref: 'Art' }],
  duration:     { type: String, default: '' },
  publishDate:  { type: Date },
  letter:       { type: String, default: '' },
  color:        { type: String, default: '' },
  note:         { type: String, default: '' },
  remarks:      { type: String, default: '' }
}, { timestamps: true });

vodSchema.index({ type: 1, status: 1 });
vodSchema.index({ type: 1, status: 1, hitsWeek: -1 });
vodSchema.index({ type: 1, status: 1, updatedAt: -1 });
vodSchema.index({ type: 1, status: 1, hits: -1 });
vodSchema.index({ type: 1, status: 1, score: -1 });
vodSchema.index({ name: 1 });
vodSchema.index({ area: 1, year: 1 });
vodSchema.index({ letter: 1 });
vodSchema.index({ name: 'text', actor: 'text', director: 'text' });

vodSchema.statics.parsePlayUrls = function(urlStr, fromStr) {
  if (!urlStr) return [];
  const servers = urlStr.split('$$$');
  const names = (fromStr || '').split('$$$');
  return servers.map((server, idx) => ({
    server: names[idx] || '线路' + (idx + 1),
    episodes: (server || '').split('#').filter(Boolean).map((ep, nid) => {
      const [name, url] = ep.split('$');
      return { nid: nid + 1, name: name || '', url: url || '' };
    })
  })).filter(s => s.episodes.length > 0);
};

module.exports = mongoose.model('Vod', vodSchema);

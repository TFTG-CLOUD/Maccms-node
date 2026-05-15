const mongoose = require('mongoose');

const artSchema = new mongoose.Schema({
  type:         { type: mongoose.Schema.Types.Mixed, ref: 'Type' },
  name:         { type: String, required: true },
  sub:          { type: String, default: '' },
  en:           { type: String, default: '' },
  author:       { type: String, default: '' },
  from:         { type: String, default: '' },
  pic:          { type: String, default: '' },
  content:      { type: String, default: '' },
  title:        { type: String, default: '' },
  note:         { type: String, default: '' },
  tags:         [{ type: String }],
  class:        { type: String, default: '' },
  hits:         { type: Number, default: 0 },
  hitsDay:      { type: Number, default: 0 },
  hitsWeek:     { type: Number, default: 0 },
  hitsMonth:    { type: Number, default: 0 },
  score:        { type: Number, default: 0 },
  scoreAll:     { type: Number, default: 0 },
  scoreNum:     { type: Number, default: 0 },
  status:       { type: Number, default: 0 },
  lock:         { type: Number, default: 0 },
  level:        { type: Number, default: 0 },
  points:       { type: Number, default: 0 },
  pointsDetail: { type: Number, default: 0 },
  tpl:          { type: String, default: '' },
  recycleTime:  { type: Number, default: 0 },
  letter:       { type: String, default: '' },
  color:        { type: String, default: '' }
}, { timestamps: true });

artSchema.index({ type: 1, status: 1 });
artSchema.index({ name: 1 });

module.exports = mongoose.model('Art', artSchema);

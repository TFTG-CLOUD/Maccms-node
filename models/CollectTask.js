const mongoose = require('mongoose');

const collectTaskSchema = new mongoose.Schema({
  collectSource: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectSource', required: true },
  sourceName:    { type: String, default: '' },
  range:         { type: String, default: 'today' },
  trigger:       { type: String, enum: ['manual', 'scheduler'], default: 'manual' },
  status:        { type: String, enum: ['pending', 'running', 'success', 'failed'], default: 'pending' },
  queuePosition: { type: Number, default: 0 },
  processed:     { type: Number, default: 0 },
  created:       { type: Number, default: 0 },
  updated:       { type: Number, default: 0 },
  skipped:       { type: Number, default: 0 },
  pages:         { type: Number, default: 0 },
  currentName:   { type: String, default: '' },
  message:       { type: String, default: '' },
  heartbeatAt:   { type: Date, default: null },
  startedAt:     { type: Date, default: null },
  finishedAt:    { type: Date, default: null },
  logs:          [{
    at: { type: Date, default: Date.now },
    text: { type: String, default: '' }
  }],
  result:        { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

collectTaskSchema.index({ collectSource: 1, createdAt: -1 });
collectTaskSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CollectTask', collectTaskSchema);

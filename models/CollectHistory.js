const mongoose = require('mongoose');

const collectHistorySchema = new mongoose.Schema({
  urlHash:        { type: String, required: true },
  collectSource:  { type: mongoose.Schema.Types.ObjectId, ref: 'CollectSource' },
  vodName:        { type: String, default: '' },
  sourceTime:     { type: String, default: '' },
  createdAt:      { type: Date, default: Date.now }
});
collectHistorySchema.index({ urlHash: 1 }, { unique: true });
collectHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 * 30 });
module.exports = mongoose.model('CollectHistory', collectHistorySchema);

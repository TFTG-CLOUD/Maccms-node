const mongoose = require('mongoose');

const collectTypeBindingSchema = new mongoose.Schema({
  collectSource:  { type: mongoose.Schema.Types.ObjectId, ref: 'CollectSource', required: true },
  sourceTypeId:   { type: String, required: true },
  sourceTypeName: { type: String, default: '' },
  localType:      { type: mongoose.Schema.Types.Mixed, ref: 'Type', required: true }
});
collectTypeBindingSchema.index({ collectSource: 1, sourceTypeId: 1 }, { unique: true });
module.exports = mongoose.model('CollectTypeBinding', collectTypeBindingSchema);

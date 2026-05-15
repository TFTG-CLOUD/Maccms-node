const mongoose = require('mongoose');

const collectSourceSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  url:        { type: String, required: true },
  type:       { type: String, enum: ['json', 'xml'], default: 'json' },
  mid:        { type: Number, default: 1 },
  appid:      { type: String, default: '' },
  appkey:     { type: String, default: '' },
  filter:     {
    area:     { type: String, default: '' },
    year:     { type: String, default: '' },
    class:    { type: String, default: '' },
    type:     [{ type: mongoose.Schema.Types.Mixed, ref: 'Type' }]
  },
  bind:       { type: Boolean, default: false },
  status:     { type: Boolean, default: true },
  lastCollect:{ type: Date },
  collectNum: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('CollectSource', collectSourceSchema);

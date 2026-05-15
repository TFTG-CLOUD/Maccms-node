const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  roleRid:  { type: mongoose.Schema.Types.ObjectId },
  roleMid:  { type: Number, default: 1 },
  name:     { type: String, required: true },
  en:       { type: String, default: '' },
  actor:    { type: String, default: '' },
  pic:      { type: String, default: '' },
  content:  { type: String, default: '' },
  status:   { type: Number, default: 0 },
  color:    { type: String, default: '' }
}, { timestamps: true });
roleSchema.index({ roleRid: 1, roleMid: 1 });
module.exports = mongoose.model('Role', roleSchema);

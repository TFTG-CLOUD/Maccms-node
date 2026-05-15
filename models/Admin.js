const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  email:      { type: String, default: '' },
  nickname:   { type: String, default: '' },
  groupId:    { type: Number, default: 1 },
  status:     { type: Number, default: 1 },
  loginTime:  { type: Date },
  loginIp:    { type: String, default: '' },
  loginNum:   { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('Admin', adminSchema);

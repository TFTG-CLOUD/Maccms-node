const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  email:      { type: String, default: '' },
  phone:      { type: String, default: '' },
  groupId:    { type: Number, default: 1 },
  points:     { type: Number, default: 0 },
  avatar:     { type: String, default: '' },
  regIp:      { type: String, default: '' },
  regTime:    { type: Date, default: Date.now },
  loginTime:  { type: Date },
  loginIp:    { type: String, default: '' },
  status:     { type: Number, default: 1 },
  endTime:    { type: Date }
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);

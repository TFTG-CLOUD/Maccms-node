const mongoose = require('mongoose');

const adminSessionSchema = new mongoose.Schema({
  sid: { type: String, required: true, unique: true },
  data: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.model('AdminSession', adminSessionSchema);

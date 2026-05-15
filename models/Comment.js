const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  refType:  { type: String, enum: ['vod', 'art', 'topic', 'manga'], required: true },
  refId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  replyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  content:  { type: String, required: true },
  status:   { type: Number, default: 0 },
  ip:       { type: String, default: '' },
  diggUp:   { type: Number, default: 0 },
  diggDown: { type: Number, default: 0 }
}, { timestamps: true });
commentSchema.index({ refType: 1, refId: 1 });
module.exports = mongoose.model('Comment', commentSchema);

const session = require('express-session');
const AdminSession = require('../models/AdminSession');

function resolveSessionExpiry(sess, ttlMs, now = Date.now()) {
  const cookieExpires = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : NaN;
  if (Number.isFinite(cookieExpires)) {
    return new Date(cookieExpires);
  }

  const cookieMaxAge = Number(sess?.cookie?.maxAge);
  if (Number.isFinite(cookieMaxAge) && cookieMaxAge > 0) {
    return new Date(now + cookieMaxAge);
  }

  return new Date(now + ttlMs);
}

class MongoSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttlMs = Math.max(60 * 1000, Number(options.ttlMs) || 30 * 24 * 60 * 60 * 1000);
  }

  get(sid, callback) {
    AdminSession.findOne({ sid }).lean()
      .then((doc) => {
        if (!doc) return callback(null, null);
        if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
          return AdminSession.deleteOne({ sid }).then(() => callback(null, null)).catch(callback);
        }

        try {
          return callback(null, JSON.parse(doc.data));
        } catch (error) {
          return callback(error);
        }
      })
      .catch(callback);
  }

  set(sid, sess, callback) {
    const expiresAt = resolveSessionExpiry(sess, this.ttlMs);
    const data = JSON.stringify(sess);

    AdminSession.findOneAndUpdate(
      { sid },
      { $set: { sid, data, expiresAt } },
      { upsert: true, new: false }
    )
      .then(() => callback?.(null))
      .catch((error) => callback?.(error));
  }

  destroy(sid, callback) {
    AdminSession.deleteOne({ sid })
      .then(() => callback?.(null))
      .catch((error) => callback?.(error));
  }

  touch(sid, sess, callback) {
    const expiresAt = resolveSessionExpiry(sess, this.ttlMs);
    AdminSession.updateOne({ sid }, { $set: { expiresAt } })
      .then(() => callback?.(null))
      .catch((error) => callback?.(error));
  }
}

module.exports = {
  MongoSessionStore,
  resolveSessionExpiry
};

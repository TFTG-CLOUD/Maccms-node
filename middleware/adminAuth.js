module.exports = function adminAuth(req, res, next) {
  if (req.path === '/admin/login') return next();
  if (req.session && req.session.admin) return next();

  if (req.method === 'GET') {
    return res.redirect('/admin/login');
  }
  res.status(401).json({ code: 0, msg: '未登录' });
};

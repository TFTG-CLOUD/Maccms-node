const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const IndexController = require('../controllers/admin/IndexController');
const TypeController = require('../controllers/admin/TypeController');
const VodController = require('../controllers/admin/VodController');
const CollectController = require('../controllers/admin/CollectController');
const TimmingController = require('../controllers/admin/TimmingController');
const SeoController = require('../controllers/admin/SeoController');
const AdController = require('../controllers/admin/AdController');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const { createRateLimiter } = require('../middleware/rateLimit');

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `admin-login:${req.ip}:${String(req.body?.name || '').trim().toLowerCase()}`,
  message: '登录尝试过于频繁，请 15 分钟后再试'
});

router.get('/login', (req, res) => res.render('login', { error: req.flash('error') }));

router.post('/login', loginRateLimiter, async (req, res) => {
  const { name, password } = req.body;
  const admin = await Admin.findOne({ name });
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    req.flash('error', '用户名或密码错误');
    return res.redirect('/admin/login');
  }
  req.session.admin = { id: admin._id, name: admin.name, groupId: admin.groupId };
  req.session.save((error) => {
    if (error) {
      req.flash('error', '登录状态保存失败，请稍后重试');
      return res.redirect('/admin/login');
    }
    return res.redirect('/admin');
  });
});

router.get('/logout', (req, res) => {
  if (!req.session) {
    return res.redirect('/admin/login');
  }
  req.session.destroy(() => {
    res.clearCookie('maccms.sid');
    return res.redirect('/admin/login');
  });
});

router.use(adminAuth);

const indexCtrl = new IndexController();
const typeCtrl = new TypeController();
const vodCtrl = new VodController();
const collectCtrl = new CollectController();
const timmingCtrl = new TimmingController();
const seoCtrl = new SeoController();
const adCtrl = new AdController();

router.get('/', (req, res) => indexCtrl.index(req, res));

router.get('/type', (req, res) => typeCtrl.index(req, res));
router.post('/type', (req, res) => typeCtrl.create(req, res));
router.get('/type/:id/edit', (req, res) => typeCtrl.edit(req, res));
router.put('/type/:id', (req, res) => typeCtrl.update(req, res));
router.delete('/type/:id', (req, res) => typeCtrl.remove(req, res));

router.get('/vod', (req, res) => vodCtrl.index(req, res));
router.post('/vod', (req, res) => vodCtrl.create(req, res));
router.get('/vod/:id/edit', (req, res) => vodCtrl.edit(req, res));
router.put('/vod/:id', (req, res) => vodCtrl.update(req, res));
router.delete('/vod/:id', (req, res) => vodCtrl.remove(req, res));
router.post('/vod/:id/audit', (req, res) => vodCtrl.audit(req, res));

router.get('/collect', (req, res) => collectCtrl.index(req, res));
router.post('/collect', (req, res) => collectCtrl.create(req, res));
router.get('/collect/tasks', (req, res) => collectCtrl.tasks(req, res));
router.get('/collect/tasks/:taskId', (req, res) => collectCtrl.taskDetail(req, res));
router.get('/collect/:id/edit', (req, res) => collectCtrl.edit(req, res));
router.put('/collect/:id', (req, res) => collectCtrl.update(req, res));
router.delete('/collect/:id', (req, res) => collectCtrl.remove(req, res));
router.post('/collect/:id/test', (req, res) => collectCtrl.test(req, res));
router.post('/collect/:id/run', (req, res) => collectCtrl.run(req, res));
router.get('/collect/:id/bindings', (req, res) => collectCtrl.bindings(req, res));
router.post('/collect/:id/bindings', (req, res) => collectCtrl.saveBindings(req, res));

router.get('/timming', (req, res) => timmingCtrl.index(req, res));
router.put('/timming/:id', (req, res) => timmingCtrl.update(req, res));
router.post('/timming/:id/run', (req, res) => timmingCtrl.run(req, res));

router.get('/seo', (req, res) => seoCtrl.index(req, res));
router.post('/seo', (req, res) => seoCtrl.update(req, res));
router.get('/ad', (req, res) => adCtrl.index(req, res));
router.post('/ad', (req, res) => adCtrl.update(req, res));

module.exports = router;

const express = require('express');
const router = express.Router();

const frontRoutes = require('./front');
const adminRoutes = require('./admin');
const apiRoutes = require('./api');

router.use('/admin', adminRoutes);
router.use('/api', apiRoutes);
router.use('/', frontRoutes);

module.exports = router;

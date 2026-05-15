const express = require('express');
const router = express.Router();
const scheduler = require('../services/Scheduler');
const Vod = require('../models/Vod');
const config = require('../config');

router.get('/timming', async (req, res) => {
  await scheduler.check();
  res.json({ code: 1, msg: '定时任务检查完成' });
});

router.get('/provide/vod/', async (req, res) => {
  const page = parseInt(req.query.pg || req.query.page) || 1;
  const pagesize = parseInt(req.query.limit) || 20;
  const hours = parseInt(req.query.h) || 0;
  const filter = { status: 1 };
  if (hours > 0) filter.createdAt = { $gte: new Date(Date.now() - hours * 3600000) };
  if (req.query.tid) filter.type = req.query.tid;

  const total = await Vod.countDocuments(filter);
  const list = await Vod.find(filter).sort({ _id: -1 }).skip((page - 1) * pagesize).limit(pagesize).lean();

  const result = {
    code: 1,
    msg: 'success',
    page: page,
    pagecount: Math.ceil(total / pagesize),
    limit: pagesize,
    total: total,
    list: list.map(v => ({
      vod_id: v._id,
      type_id: v.type,
      vod_name: v.name,
      vod_en: v.en,
      vod_sub: v.sub,
      vod_actor: v.actor,
      vod_director: v.director,
      vod_pic: v.pic,
      vod_content: v.content,
      vod_year: v.year,
      vod_area: v.area,
      vod_lang: v.lang,
      vod_class: v.class,
      vod_tag: (v.tags || []).join(','),
      vod_total: v.total,
      vod_serial: v.serial,
      vod_isend: v.isEnd ? 1 : 0,
      vod_hits: v.hits,
      vod_score: v.score,
      vod_time: v.updatedAt ? new Date(v.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : ''
    }))
  };

  res.json(result);
});

module.exports = router;

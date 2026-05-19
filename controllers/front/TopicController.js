const config = require('../../config');
const Topic = require('../../models/Topic');
const { normalizeMediaEntity, normalizeMediaList } = require('../../utils/front');

class TopicController {
  async index(req, res) {
    const page = req.mac.params.page || 1;
    const pagesize = 20;
    const total = await Topic.countDocuments({ status: 1 });
    const list = await Topic.find({ status: 1 }).sort({ updatedAt: -1 }).skip((page - 1) * pagesize).limit(pagesize).lean();
    res.render('stui/topic/index', { maccms: config, list: normalizeMediaList(list), param: { page }, page, total, seo: { title: '专题列表 - ' + config.siteName, keywords: '', description: '' } });
  }

  async detail(req, res) {
    const id = req.mac.params.id;
    if (!id) return res.status(404).render('error', { message: '参数错误' });
    const topic = await Topic.findById(id).populate('relVods relArts').lean();
    if (!topic) return res.status(404).render('error', { message: '专题不存在' });
    Topic.updateOne(
      { _id: topic._id },
      { $inc: { hits: 1 } },
      { timestamps: false }
    ).exec();
    const normalizedTopic = normalizeMediaEntity(topic);
    res.render('stui/topic/detail', { maccms: config, obj: normalizedTopic, topic: normalizedTopic, param: req.mac.params, seo: { title: topic.name + ' - ' + config.siteName, keywords: topic.name, description: (topic.content || '').substring(0, 200) } });
  }
}

module.exports = TopicController;

const config = require('../../config');
const Actor = require('../../models/Actor');

class ActorController {
  async index(req, res) {
    const page = req.mac.params.page || 1;
    const pagesize = 30;
    const total = await Actor.countDocuments({ status: 1 });
    const list = await Actor.find({ status: 1 }).sort({ updatedAt: -1 }).skip((page - 1) * pagesize).limit(pagesize).lean();
    res.render('actor/index', { maccms: config, list, param: { page }, page, total, seo: { title: '演员列表 - ' + config.siteName, keywords: '', description: '' } });
  }

  async detail(req, res) {
    const id = req.mac.params.id;
    if (!id) return res.status(404).render('error', { message: '参数错误' });
    const actor = await Actor.findById(id).lean();
    if (!actor) return res.status(404).render('error', { message: '演员不存在' });
    Actor.updateOne({ _id: actor._id }, { $inc: { hits: 1 } }).exec();
    res.render('actor/detail', { maccms: config, obj: actor, actor, param: req.mac.params, seo: { title: actor.name + ' - ' + config.siteName, keywords: actor.name, description: (actor.content || '').substring(0, 200) } });
  }
}

module.exports = ActorController;

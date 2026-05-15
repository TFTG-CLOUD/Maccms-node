const Vod = require('../../models/Vod');
const CollectSource = require('../../models/CollectSource');

class IndexController {
  async index(req, res) {
    const vodCount = await Vod.countDocuments();
    const todayCount = await Vod.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } });
    const sourceCount = await CollectSource.countDocuments({ status: true });
    res.render('index/index', { vodCount, todayCount, sourceCount });
  }
}

module.exports = IndexController;

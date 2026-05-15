const timmingConfig = require('../../config/timming');
const fs = require('fs');
const path = require('path');
const scheduler = require('../../services/Scheduler');

const configPath = path.join(__dirname, '../../config/timming.js');

class TimmingController {
  async index(req, res) {
    const list = [...timmingConfig];
    res.render('timming/index', { list });
  }
  async update(req, res) {
    const id = parseInt(req.params.id);
    if (timmingConfig[id]) {
      Object.assign(timmingConfig[id], req.body);
      const content = 'module.exports = ' + JSON.stringify(timmingConfig, null, 2) + ';\n';
      fs.writeFileSync(configPath, content);
    }
    res.json({ code: 1, msg: 'ok' });
  }
  async run(req, res) {
    const id = parseInt(req.params.id);
    const task = timmingConfig[id];
    if (!task) return res.json({ code: 0, msg: '任务不存在' });
    const result = await scheduler.execute(task);
    if (task.file === 'collect') {
      return res.json({
        code: 1,
        msg: `已加入后台采集任务${result.queued ? `，共 ${result.queued} 个采集源` : ''}`,
        data: result
      });
    }
    res.json({ code: 1, msg: '执行完成', data: result });
  }
}

module.exports = TimmingController;

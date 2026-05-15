const collectTaskRunner = require('./CollectTaskRunner');
const hitStatsService = require('./HitStatsService');
const timmingConfig = require('../config/timming');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/timming.js');

class Scheduler {
  async check() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = String(now.getHours()).padStart(2, '0');

    for (const task of timmingConfig) {
      if (task.status !== 1) continue;
      if (!this.shouldRun(task, dayOfWeek, hour)) continue;
      await this.execute(task);
      task.runtime = now.getTime();
    }

    this.saveConfig();
  }

  shouldRun(task, dayOfWeek, hour) {
    if (!task.hours) return false;
    const weeks = (task.weeks || '').split(',').filter(Boolean).map(Number);
    const hours = task.hours.split(',').filter(Boolean);
    const monthdays = String(task.monthdays || '').split(',').filter(Boolean).map(Number);
    if (weeks.length > 0 && !weeks.includes(dayOfWeek)) return false;
    if (monthdays.length > 0 && !monthdays.includes(new Date().getDate())) return false;
    if (hours.length > 0 && !hours.includes(hour)) return false;
    if (task.runtime) {
      const lastRun = new Date(task.runtime);
      if (lastRun.getDate() === new Date().getDate() && lastRun.getHours() === new Date().getHours()) {
        return false;
      }
    }
    return true;
  }

  async execute(task) {
    console.log('Executing task:', task.name);
    switch (task.file) {
      case 'collect': {
        const range = task.param?.type || '1day';
        const tasks = await collectTaskRunner.enqueueForAllSources({
          range,
          trigger: 'scheduler'
        });
        return {
          queued: tasks.length,
          range
        };
      }
      case 'cache': {
        return { queued: 0, range: '' };
      }
      case 'hits': {
        return hitStatsService.resetScope(task.param?.scope || 'day');
      }
      default:
        console.log('Unknown task file:', task.file);
        return { queued: 0, range: '' };
    }
  }

  saveConfig() {
    const content = 'module.exports = ' + JSON.stringify(timmingConfig, null, 2) + ';\n';
    fs.writeFileSync(configPath, content);
  }
}

module.exports = new Scheduler();

const CollectSource = require('../models/CollectSource');
const CollectTask = require('../models/CollectTask');
const collectEngine = require('./CollectEngine');
const { clearCache } = require('../middleware/pageCache');
const { clearRuntimeCache } = require('../utils/runtimeCache');
const {
  DEFAULT_TASK_STALE_MS,
  MAX_TASK_LOGS,
  buildExistingTaskNotice,
  buildPendingTaskMessage,
  isTaskHeartbeatStale
} = require('../utils/collectTaskProgress');

class CollectTaskRunner {
  constructor() {
    this.queue = [];
    this.running = false;
    this.activeTaskId = null;
    this.activeSourceName = '';
  }

  async enqueue({ sourceId, range, trigger = 'manual' }) {
    const source = await CollectSource.findById(sourceId).lean();
    if (!source || !source.status) {
      throw new Error('采集源未找到或已禁用');
    }

    const normalized = collectEngine.buildCollectRunOptions({ range, type: range });
    const activeKey = String(source._id);
    const existingTask = await CollectTask.findOne({
      collectSource: sourceId,
      status: { $in: ['pending', 'running'] }
    }).sort({ createdAt: -1 }).lean();

    if (existingTask) {
      return {
        ...existingTask,
        reusedExisting: true,
        enqueueMessage: buildExistingTaskNotice(existingTask)
      };
    }

    const queuePosition = this.queue.length + (this.running ? 1 : 0) + 1;
    let task;
    try {
      task = await CollectTask.create({
        collectSource: source._id,
        sourceName: source.name,
        range: normalized.type,
        trigger,
        activeKey,
        status: 'pending',
        queuePosition,
        heartbeatAt: new Date(),
        message: buildPendingTaskMessage(queuePosition, this.activeSourceName),
        logs: [{
          at: new Date(),
          text: `任务已创建，等待执行 ${normalized.type}`
        }]
      });
    } catch (error) {
      if (error?.code === 11000) {
        const duplicatedTask = await CollectTask.findOne({
          activeKey,
          status: { $in: ['pending', 'running'] }
        }).sort({ createdAt: -1 }).lean();
        if (duplicatedTask) {
          return {
            ...duplicatedTask,
            reusedExisting: true,
            enqueueMessage: buildExistingTaskNotice(duplicatedTask)
          };
        }
      }
      throw error;
    }

    this.queue.push(String(task._id));
    await this.refreshPendingMessages();
    this.processQueue().catch((error) => {
      console.error('Collect task queue error:', error.message);
    });

    return task.toObject();
  }

  async enqueueForAllSources({ range, trigger = 'scheduler' }) {
    const sources = await CollectSource.find({ status: true, mid: 1 }).lean();
    const tasks = [];
    for (const source of sources) {
      const task = await this.enqueue({ sourceId: source._id, range, trigger });
      tasks.push(task);
    }
    return tasks;
  }

  async getTask(taskId) {
    await this.failStaleTasks();
    return CollectTask.findById(taskId).lean();
  }

  async listRecent(limit = 20) {
    await this.failStaleTasks();
    return CollectTask.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async recoverStaleTasks() {
    const now = new Date();
    await CollectTask.updateMany(
      { status: { $in: ['pending', 'running'] } },
      {
        $set: {
          activeKey: null,
          status: 'failed',
          queuePosition: 0,
          heartbeatAt: now,
          finishedAt: now,
          message: '服务重启，任务已中断，请重新发起采集'
        },
        $push: {
          logs: {
            $each: [{
              at: now,
              text: '服务重启，旧任务已重置'
            }],
            $slice: -MAX_TASK_LOGS
          }
        }
      }
    );
    this.queue = [];
    this.running = false;
    this.activeTaskId = null;
    this.activeSourceName = '';
  }

  async failStaleTasks(options = {}) {
    const maxIdleMs = Math.max(1, Number(options.maxIdleMs) || DEFAULT_TASK_STALE_MS);
    const now = options.now instanceof Date ? options.now : new Date();
    const tasks = await CollectTask.find({ status: 'running' }).lean();
    const staleTasks = tasks.filter((task) => {
      if (this.activeTaskId && String(task._id) === String(this.activeTaskId)) {
        return false;
      }
      return isTaskHeartbeatStale(task, { now, maxIdleMs });
    });
    if (staleTasks.length === 0) return 0;

    const staleIds = staleTasks.map((task) => String(task._id));
    this.queue = this.queue.filter((taskId) => !staleIds.includes(String(taskId)));

    await Promise.all(staleTasks.map((task) => this.patchTask(task._id, {
      activeKey: null,
      status: 'failed',
      queuePosition: 0,
      heartbeatAt: now,
      finishedAt: now,
      message: '任务心跳超时，已自动终止，请重新发起采集'
    }, '任务心跳超时，已自动终止')));

    await this.refreshPendingMessages();
    return staleTasks.length;
  }

  async processQueue() {
    if (this.running) return;
    this.running = true;

    try {
      while (this.queue.length > 0) {
        const taskId = this.queue.shift();
        this.activeTaskId = taskId;
        await this.refreshPendingMessages();
        await this.runTask(taskId);
      }
    } finally {
      this.activeTaskId = null;
      this.activeSourceName = '';
      this.running = false;
      await this.refreshPendingMessages();
    }
  }

  async runTask(taskId) {
    const task = await CollectTask.findById(taskId).lean();
    if (!task || task.status === 'success' || task.status === 'failed') return;

    this.activeSourceName = String(task.sourceName || '').trim();
    await this.patchTask(taskId, {
      status: 'running',
      queuePosition: 0,
      heartbeatAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      message: '开始采集，准备拉取列表',
      currentName: '',
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      pages: 0
    }, '开始采集，准备拉取列表');

    try {
      const result = await collectEngine.run(task.collectSource, {
        type: task.range,
        onStatus: async (status) => {
          await this.patchTask(taskId, {
            heartbeatAt: new Date(),
            message: status?.message || '采集中',
            currentName: status?.currentName || ''
          }, status?.log || status?.message || '');
        },
        onProgress: async (progress) => {
          await this.patchTask(taskId, {
            heartbeatAt: new Date(),
            processed: progress.processed || 0,
            created: progress.created || 0,
            updated: progress.updated || 0,
            skipped: progress.skipped || 0,
            pages: progress.page || 0,
            currentName: progress.currentName || '',
            message: this.progressMessage(progress)
          });
        }
      });

      await this.patchTask(taskId, {
        activeKey: null,
        status: 'success',
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        processed: result.processed || 0,
        created: result.created || 0,
        updated: result.updated || 0,
        skipped: result.skipped || 0,
        pages: result.pages || 0,
        result,
        message: `采集完成：新增 ${result.created || 0}，更新 ${result.updated || 0}`
      }, `采集完成：新增 ${result.created || 0}，更新 ${result.updated || 0}`);
      await Promise.all([
        clearRuntimeCache('front:'),
        clearCache()
      ]);
    } catch (error) {
      await this.patchTask(taskId, {
        activeKey: null,
        status: 'failed',
        heartbeatAt: new Date(),
        finishedAt: new Date(),
        message: error.message || '采集失败'
      }, error.message || '采集失败');
    } finally {
      this.activeSourceName = '';
      await this.refreshPendingMessages();
    }
  }

  progressMessage(progress) {
    if (!progress) return '采集中';
    const actionLabel = progress.action === 'updated' ? '更新' : '新增';
    const currentName = progress.currentName ? `：${progress.currentName}` : '';
    return `${actionLabel}${currentName}`;
  }

  async patchTask(taskId, setFields = {}, logText = '') {
    const update = {
      $set: {
        ...setFields
      }
    };

    if (logText) {
      update.$push = {
        logs: {
          $each: [{
            at: new Date(),
            text: String(logText).trim()
          }],
          $slice: -MAX_TASK_LOGS
        }
      };
    }

    await CollectTask.findByIdAndUpdate(taskId, update);
  }

  async refreshPendingMessages() {
    const activeName = this.activeSourceName;
    const now = new Date();
    const updates = this.queue.map((taskId, index) => CollectTask.findByIdAndUpdate(taskId, {
      queuePosition: index + 1,
      heartbeatAt: now,
      message: buildPendingTaskMessage(index + 1, activeName)
    }));
    await Promise.all(updates);
  }
}

module.exports = new CollectTaskRunner();

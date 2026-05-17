const test = require('node:test');
const assert = require('node:assert/strict');

const CollectSource = require('../models/CollectSource');
const CollectTask = require('../models/CollectTask');
const collectTaskRunner = require('../services/CollectTaskRunner');

test('enqueue returns existing pending task with explicit notice', async () => {
  const originalFindById = CollectSource.findById;
  const originalFindOne = CollectTask.findOne;

  CollectSource.findById = () => ({
    lean: async () => ({ _id: 'source-1', name: '360资源', status: true })
  });
  CollectTask.findOne = () => ({
    sort: () => ({
      lean: async () => ({
        _id: 'task-1',
        sourceName: '360资源',
        status: 'pending'
      })
    })
  });

  try {
    const task = await collectTaskRunner.enqueue({ sourceId: 'source-1', range: '1day', trigger: 'manual' });
    assert.equal(task.reusedExisting, true);
    assert.equal(task.enqueueMessage, '360资源 已有任务在队列中，请在下方任务列表等待执行');
  } finally {
    CollectSource.findById = originalFindById;
    CollectTask.findOne = originalFindOne;
  }
});

test('recoverStaleTasks resets pending and running tasks after restart', async () => {
  const originalUpdateMany = CollectTask.updateMany;
  let capturedFilter = null;
  let capturedUpdate = null;

  CollectTask.updateMany = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { acknowledged: true, modifiedCount: 2 };
  };

  try {
    await collectTaskRunner.recoverStaleTasks();
  } finally {
    CollectTask.updateMany = originalUpdateMany;
  }

  assert.deepEqual(capturedFilter, { status: { $in: ['pending', 'running'] } });
  assert.equal(capturedUpdate.$set.status, 'failed');
  assert.equal(capturedUpdate.$set.message, '服务重启，任务已中断，请重新发起采集');
  assert.equal(capturedUpdate.$set.queuePosition, 0);
  assert.equal(capturedUpdate.$push.logs.$each[0].text, '服务重启，旧任务已重置');
});

test('failStaleTasks marks timed-out running tasks as failed', async () => {
  const originalFind = CollectTask.find;
  const originalFindByIdAndUpdate = CollectTask.findByIdAndUpdate;
  const updates = [];

  CollectTask.find = () => ({
    lean: async () => ([
      {
        _id: 'task-stale',
        status: 'running',
        heartbeatAt: new Date(Date.now() - 11 * 60 * 1000).toISOString()
      },
      {
        _id: 'task-fresh',
        status: 'running',
        heartbeatAt: new Date(Date.now() - 60 * 1000).toISOString()
      }
    ])
  });
  CollectTask.findByIdAndUpdate = async (id, update) => {
    updates.push({ id, update });
    return { acknowledged: true };
  };

  try {
    const count = await collectTaskRunner.failStaleTasks();
    assert.equal(count, 1);
  } finally {
    CollectTask.find = originalFind;
    CollectTask.findByIdAndUpdate = originalFindByIdAndUpdate;
  }

  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, 'task-stale');
  assert.equal(updates[0].update.$set.status, 'failed');
  assert.equal(updates[0].update.$set.message, '任务心跳超时，已自动终止，请重新发起采集');
});

test('runTask does not trigger cache invalidation after successful collect', async () => {
  const collectTaskPath = require.resolve('../services/CollectTaskRunner');
  const collectEnginePath = require.resolve('../services/CollectEngine');
  const pageCachePath = require.resolve('../middleware/pageCache');
  const runtimeCachePath = require.resolve('../utils/runtimeCache');

  const originalCollectTaskModule = require.cache[collectTaskPath];
  const originalCollectEngineModule = require.cache[collectEnginePath];
  const originalPageCacheModule = require.cache[pageCachePath];
  const originalRuntimeCacheModule = require.cache[runtimeCachePath];
  const originalFindById = CollectTask.findById;
  const originalFindByIdAndUpdate = CollectTask.findByIdAndUpdate;

  const invalidationCalls = [];
  const markInvalidation = () => {
    invalidationCalls.push(true);
    return Promise.resolve();
  };

  delete require.cache[collectTaskPath];
  require.cache[collectEnginePath] = {
    id: collectEnginePath,
    filename: collectEnginePath,
    loaded: true,
    exports: {
      run: async () => ({
        processed: 1,
        created: 1,
        updated: 0,
        skipped: 0,
        pages: 1,
        changedVodIds: ['vod-1']
      })
    }
  };
  require.cache[pageCachePath] = {
    id: pageCachePath,
    filename: pageCachePath,
    loaded: true,
    exports: {
      clearCache: markInvalidation,
      clearVodPageCaches: markInvalidation
    }
  };
  require.cache[runtimeCachePath] = {
    id: runtimeCachePath,
    filename: runtimeCachePath,
    loaded: true,
    exports: {
      clearRuntimeCache: markInvalidation
    }
  };

  CollectTask.findById = () => ({
    lean: async () => ({
      _id: 'task-success',
      collectSource: 'source-1',
      sourceName: 'demo',
      range: '1day',
      status: 'pending'
    })
  });
  CollectTask.findByIdAndUpdate = async () => ({ acknowledged: true });

  const isolatedRunner = require('../services/CollectTaskRunner');

  try {
    await isolatedRunner.runTask('task-success');
    assert.equal(invalidationCalls.length, 0);
  } finally {
    CollectTask.findById = originalFindById;
    CollectTask.findByIdAndUpdate = originalFindByIdAndUpdate;

    if (originalCollectTaskModule) require.cache[collectTaskPath] = originalCollectTaskModule;
    else delete require.cache[collectTaskPath];

    if (originalCollectEngineModule) require.cache[collectEnginePath] = originalCollectEngineModule;
    else delete require.cache[collectEnginePath];

    if (originalPageCacheModule) require.cache[pageCachePath] = originalPageCacheModule;
    else delete require.cache[pageCachePath];

    if (originalRuntimeCacheModule) require.cache[runtimeCachePath] = originalRuntimeCacheModule;
    else delete require.cache[runtimeCachePath];
  }
});

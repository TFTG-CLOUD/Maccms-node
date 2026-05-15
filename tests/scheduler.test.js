const test = require('node:test');
const assert = require('node:assert/strict');

const scheduler = require('../services/Scheduler');
const collectTaskRunner = require('../services/CollectTaskRunner');
const collectEngine = require('../services/CollectEngine');
const CollectSource = require('../models/CollectSource');
const hitStatsService = require('../services/HitStatsService');

test('scheduler collect tasks enqueue background jobs instead of running collect engine directly', async () => {
  const originalEnqueue = collectTaskRunner.enqueueForAllSources;
  const originalRun = collectEngine.run;
  const originalFind = CollectSource.find;

  const calls = [];

  collectTaskRunner.enqueueForAllSources = async (options) => {
    calls.push(options);
    return [{ _id: 'task-1' }];
  };
  CollectSource.find = async () => [{ _id: 'source-1', name: 'demo' }];

  collectEngine.run = async () => {
    throw new Error('scheduler should not call collect engine directly');
  };

  try {
    await scheduler.execute({
      file: 'collect',
      name: 'collect_2day',
      param: { type: '2day' }
    });
  } finally {
    collectTaskRunner.enqueueForAllSources = originalEnqueue;
    collectEngine.run = originalRun;
    CollectSource.find = originalFind;
  }

  assert.deepEqual(calls, [{ range: '2day', trigger: 'scheduler' }]);
});

test('scheduler hit stats tasks reset rolling counters through the hit stats service', async () => {
  const originalResetScope = hitStatsService.resetScope;
  const calls = [];

  hitStatsService.resetScope = async (scope) => {
    calls.push(scope);
    return { scope, vodModified: 10, artModified: 5 };
  };

  try {
    const result = await scheduler.execute({
      file: 'hits',
      name: 'hits_week_reset',
      param: { scope: 'week' }
    });
    assert.deepEqual(result, { scope: 'week', vodModified: 10, artModified: 5 });
  } finally {
    hitStatsService.resetScope = originalResetScope;
  }

  assert.deepEqual(calls, ['week']);
});

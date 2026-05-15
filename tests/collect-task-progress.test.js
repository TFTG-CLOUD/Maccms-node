const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_TASK_STALE_MS,
  MAX_TASK_LOGS,
  appendTaskLog,
  buildExistingTaskNotice,
  buildPendingTaskMessage,
  isTaskHeartbeatStale
} = require('../utils/collectTaskProgress');

test('buildPendingTaskMessage includes queue position and active source name', () => {
  assert.equal(buildPendingTaskMessage(2, '360资源'), '队列第 2 位，当前执行 360资源');
  assert.equal(buildPendingTaskMessage(0, ''), '等待执行');
});

test('buildExistingTaskNotice distinguishes pending and running tasks', () => {
  assert.equal(
    buildExistingTaskNotice({ status: 'running', sourceName: '魔都' }),
    '魔都 已有任务正在执行，请在下方任务列表查看进度'
  );
  assert.equal(
    buildExistingTaskNotice({ status: 'pending', sourceName: '无尽' }),
    '无尽 已有任务在队列中，请在下方任务列表等待执行'
  );
});

test('appendTaskLog appends logs and trims to the configured limit', () => {
  let logs = [];
  for (let index = 0; index < MAX_TASK_LOGS + 3; index += 1) {
    logs = appendTaskLog(logs, `日志 ${index}`, { now: new Date(`2026-05-15T15:${String(index).padStart(2, '0')}:00.000Z`) });
  }

  assert.equal(logs.length, MAX_TASK_LOGS);
  assert.equal(logs[0].text, '日志 3');
  assert.equal(logs.at(-1).text, `日志 ${MAX_TASK_LOGS + 2}`);
});

test('isTaskHeartbeatStale detects long-idle running tasks', () => {
  const now = new Date('2026-05-15T16:00:00.000Z');

  assert.equal(isTaskHeartbeatStale({
    heartbeatAt: new Date(now.getTime() - DEFAULT_TASK_STALE_MS - 1000).toISOString()
  }, { now }), true);

  assert.equal(isTaskHeartbeatStale({
    heartbeatAt: new Date(now.getTime() - 60 * 1000).toISOString()
  }, { now }), false);
});

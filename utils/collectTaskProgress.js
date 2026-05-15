const MAX_TASK_LOGS = 40;
const DEFAULT_TASK_STALE_MS = 10 * 60 * 1000;

function buildPendingTaskMessage(position, activeSourceName = '') {
  const queueText = position > 0 ? `队列第 ${position} 位` : '等待执行';
  if (!activeSourceName) return queueText;
  return `${queueText}，当前执行 ${String(activeSourceName).trim()}`;
}

function buildExistingTaskNotice(task = {}) {
  const sourceName = String(task.sourceName || '').trim();
  if (task.status === 'running') {
    return sourceName
      ? `${sourceName} 已有任务正在执行，请在下方任务列表查看进度`
      : '已有任务正在执行，请在下方任务列表查看进度';
  }
  if (task.status === 'pending') {
    return sourceName
      ? `${sourceName} 已有任务在队列中，请在下方任务列表等待执行`
      : '已有任务在队列中，请在下方任务列表等待执行';
  }
  return '任务已存在';
}

function appendTaskLog(logs = [], text, options = {}) {
  const message = String(text || '').trim();
  if (!message) return Array.isArray(logs) ? logs.slice(-MAX_TASK_LOGS) : [];

  const now = options.now instanceof Date ? options.now : new Date();
  const limit = Math.max(1, Number(options.limit) || MAX_TASK_LOGS);
  const nextLogs = Array.isArray(logs) ? logs.slice() : [];
  nextLogs.push({
    at: now,
    text: message
  });
  return nextLogs.slice(-limit);
}

function isTaskHeartbeatStale(task = {}, options = {}) {
  const maxIdleMs = Math.max(1, Number(options.maxIdleMs) || DEFAULT_TASK_STALE_MS);
  const now = options.now instanceof Date
    ? options.now.getTime()
    : (Number.isFinite(options.now) ? Number(options.now) : Date.now());
  const lastValue = task.heartbeatAt || task.startedAt || task.createdAt || null;
  if (!lastValue) return false;
  const lastTime = new Date(lastValue).getTime();
  if (!Number.isFinite(lastTime)) return false;
  return now - lastTime >= maxIdleMs;
}

module.exports = {
  DEFAULT_TASK_STALE_MS,
  MAX_TASK_LOGS,
  appendTaskLog,
  buildExistingTaskNotice,
  buildPendingTaskMessage,
  isTaskHeartbeatStale
};

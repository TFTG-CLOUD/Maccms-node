require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const CollectSource = require('../models/CollectSource');
const CollectTask = require('../models/CollectTask');
const Vod = require('../models/Vod');
const collectTaskRunner = require('../services/CollectTaskRunner');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString();
}

function taskSnapshot(task) {
  return [
    task.status || '-',
    task.message || '-',
    task.currentName || '-',
    task.processed || 0,
    task.created || 0,
    task.updated || 0,
    task.skipped || 0,
    task.pages || 0
  ].join('|');
}

async function main() {
  const sourceName = process.argv[2] || '360资源';
  const range = process.argv[3] || '1day';
  const timeoutMs = Number(process.argv[4] || 8 * 60 * 1000);
  const pollMs = 3000;

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const source = await CollectSource.findOne({ name: sourceName, status: true }).lean();
    if (!source) {
      throw new Error(`采集源不存在或未启用: ${sourceName}`);
    }

    const startedAt = new Date();
    console.log(`[collect-smoke] source=${source.name} range=${range} startedAt=${startedAt.toISOString()}`);

    const queuedTask = await collectTaskRunner.enqueue({
      sourceId: source._id,
      range,
      trigger: 'manual'
    });
    const taskId = String(queuedTask._id || queuedTask.id);
    console.log(`[collect-smoke] taskId=${taskId} enqueueMessage=${queuedTask.enqueueMessage || queuedTask.message || '已入队'}`);

    let lastSnapshot = '';
    let finalTask = null;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const task = await CollectTask.findById(taskId).lean();
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      const snapshot = taskSnapshot(task);
      if (snapshot !== lastSnapshot) {
        lastSnapshot = snapshot;
        console.log(
          `[collect-smoke] status=${task.status} message=${task.message || '-'} current=${task.currentName || '-'} ` +
          `processed=${task.processed || 0} created=${task.created || 0} updated=${task.updated || 0} skipped=${task.skipped || 0} pages=${task.pages || 0}`
        );
      }

      if (task.status === 'success' || task.status === 'failed') {
        finalTask = task;
        break;
      }

      await sleep(pollMs);
    }

    if (!finalTask) {
      throw new Error(`任务轮询超时，超过 ${timeoutMs}ms`);
    }

    const changedVodCount = await Vod.countDocuments({ updatedAt: { $gte: startedAt } });
    const createdVodCount = await Vod.countDocuments({ createdAt: { $gte: startedAt } });
    const changedVods = await Vod.find({ updatedAt: { $gte: startedAt } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    const sampleVod = changedVods.find((item) => {
      return item
        && typeof item.pic === 'string'
        && item.pic.startsWith('/upload/vod/')
        && Array.isArray(item.playUrls)
        && item.playUrls.length > 0;
    }) || changedVods[0] || null;

    let sample = null;
    if (sampleVod) {
      const localPicPath = sampleVod.pic && sampleVod.pic.startsWith('/upload/')
        ? path.join(__dirname, '..', 'public', sampleVod.pic.replace(/^\/+/, ''))
        : '';
      sample = {
        name: sampleVod.name,
        pic: sampleVod.pic || '',
        picIsLocal: Boolean(sampleVod.pic && sampleVod.pic.startsWith('/upload/')),
        picExists: localPicPath ? fs.existsSync(localPicPath) : false,
        updatedAt: formatDate(sampleVod.updatedAt),
        playSourceCount: Array.isArray(sampleVod.playUrls) ? sampleVod.playUrls.length : 0,
        firstPlaySource: sampleVod.playUrls?.[0]?.server || '',
        firstEpisodeCount: sampleVod.playUrls?.[0]?.episodes?.length || 0,
        firstEpisodeName: sampleVod.playUrls?.[0]?.episodes?.[0]?.name || ''
      };
    }

    const output = {
      source: source.name,
      range,
      task: {
        id: taskId,
        status: finalTask.status,
        message: finalTask.message,
        processed: finalTask.processed || 0,
        created: finalTask.created || 0,
        updated: finalTask.updated || 0,
        skipped: finalTask.skipped || 0,
        pages: finalTask.pages || 0,
        startedAt: formatDate(finalTask.startedAt),
        heartbeatAt: formatDate(finalTask.heartbeatAt),
        finishedAt: formatDate(finalTask.finishedAt),
        logs: Array.isArray(finalTask.logs) ? finalTask.logs.slice(-10).map((log) => ({
          at: formatDate(log.at),
          text: log.text || ''
        })) : []
      },
      vodChanges: {
        updatedSinceStart: changedVodCount,
        createdSinceStart: createdVodCount
      },
      sampleVod: sample
    };

    console.log(JSON.stringify(output, null, 2));

    if (finalTask.status !== 'success') {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('[collect-smoke] error:', error && error.stack ? error.stack : error);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // ignore
    }
    process.exitCode = 1;
  });
}

module.exports = {
  main
};

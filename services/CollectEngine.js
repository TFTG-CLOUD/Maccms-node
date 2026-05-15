const httpClient = require('../utils/httpClient');
const { md5 } = require('../utils/helpers');
const CollectSource = require('../models/CollectSource');
const CollectTypeBinding = require('../models/CollectTypeBinding');
const CollectHistory = require('../models/CollectHistory');
const Vod = require('../models/Vod');
const mongoose = require('mongoose');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const TIME_RANGE = {
  today: 24,
  '1day': 24,
  '2day': 48,
  week: 168,
  month: 720,
  '3month': 2160,
  all: 0
};

const DEFAULT_IMAGE_CONCURRENCY = 5;
const DEFAULT_IMAGE_RETRY = 2;
const DEFAULT_POSTER_PATH = '/img/no-poster.webp';
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'upload', 'vod');

function normalizeCollectRange(type) {
  const key = String(type || 'today').trim() || 'today';
  if (Object.prototype.hasOwnProperty.call(TIME_RANGE, key)) {
    return { key, hours: TIME_RANGE[key] };
  }
  return { key: 'today', hours: TIME_RANGE.today };
}

function buildCollectRunOptions(input = {}) {
  const range = input.range || input.type || 'today';
  return { type: normalizeCollectRange(range).key };
}

function getCollectTypeIds(binding, item) {
  return String(item.type_id || item.tid || '');
}

function buildCollectUrlHash(item) {
  const doubanId = String(item.vod_douban_id || item.douban_id || '').trim();
  if (doubanId) {
    return md5(`douban:${doubanId}`);
  }

  const sourceId = String(item.vod_id || item.id || '').trim();
  const vodName = String(item.vod_name || item.name || '').trim();
  const typeId = String(item.type_id || item.tid || '').trim();
  return md5(`${sourceId}|${vodName}|${typeId}`);
}

function hasMeaningfulValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return true;
}

function normalizeEpisode(episode, index) {
  return {
    nid: index + 1,
    name: String(episode?.name || `第${index + 1}集`).trim(),
    url: String(episode?.url || '').trim()
  };
}

function normalizeEpisodes(episodes = []) {
  const result = [];
  const seen = new Set();

  for (const episode of episodes) {
    const url = String(episode?.url || '').trim();
    const name = String(episode?.name || '').trim();
    if (!url) continue;

    const key = `${url}::${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name, url });
  }

  return result.map((episode, index) => normalizeEpisode(episode, index));
}

function mergePlayUrls(existingUrls = [], incomingUrls = []) {
  const merged = (Array.isArray(existingUrls) ? existingUrls : []).map((server) => ({
    server: String(server?.server || '').trim(),
    episodes: normalizeEpisodes(server?.episodes || [])
  })).filter((server) => server.server && server.episodes.length > 0);

  const serverIndexMap = new Map(
    merged.map((server, index) => [server.server.toLowerCase(), index])
  );

  for (const server of Array.isArray(incomingUrls) ? incomingUrls : []) {
    const serverName = String(server?.server || '').trim();
    const normalizedEpisodes = normalizeEpisodes(server?.episodes || []);
    if (!serverName || normalizedEpisodes.length === 0) continue;

    const serverKey = serverName.toLowerCase();
    const existingIndex = serverIndexMap.get(serverKey);

    if (existingIndex === undefined) {
      serverIndexMap.set(serverKey, merged.length);
      merged.push({
        server: serverName,
        episodes: normalizedEpisodes
      });
      continue;
    }

    const currentEpisodes = merged[existingIndex].episodes || [];
    const currentKeys = new Set(
      currentEpisodes.map((episode) => `${episode.url}::${episode.name}`)
    );

    for (const episode of normalizedEpisodes) {
      const episodeKey = `${episode.url}::${episode.name}`;
      if (currentKeys.has(episodeKey)) continue;
      currentKeys.add(episodeKey);
      currentEpisodes.push({
        name: episode.name,
        url: episode.url
      });
    }

    merged[existingIndex].episodes = normalizeEpisodes(currentEpisodes);
  }

  return merged;
}

function mergeTags(existingTags = [], incomingTags = []) {
  const merged = new Set();
  for (const tag of [...existingTags, ...incomingTags]) {
    const value = String(tag || '').trim();
    if (!value) continue;
    merged.add(value);
  }
  return [...merged];
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortObjectKeys(value[key]);
      return acc;
    }, {});
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function normalizeVodForComparison(vod = {}) {
  return sortObjectKeys({
    name: pickPreferredString(vod.name, ''),
    en: pickPreferredString(vod.en, ''),
    sub: pickPreferredString(vod.sub, ''),
    type: hasMeaningfulValue(vod.type) ? String(vod.type) : '',
    actor: pickPreferredString(vod.actor, ''),
    director: pickPreferredString(vod.director, ''),
    writer: pickPreferredString(vod.writer, ''),
    pic: pickPreferredString(vod.pic, ''),
    content: pickPreferredString(vod.content, ''),
    playUrls: mergePlayUrls(vod.playUrls || [], []),
    downUrls: mergePlayUrls(vod.downUrls || [], []),
    year: pickPreferredNumber(vod.year, 0),
    area: pickPreferredString(vod.area, ''),
    lang: pickPreferredString(vod.lang, ''),
    class: pickPreferredString(vod.class, ''),
    tags: mergeTags(vod.tags || [], []),
    total: pickPreferredNumber(vod.total, 0),
    serial: pickPreferredString(vod.serial, ''),
    isEnd: pickPreferredBoolean(vod.isEnd, false),
    score: pickPreferredNumber(vod.score, 0),
    doubanScore: pickPreferredNumber(vod.doubanScore, 0),
    doubanId: pickPreferredString(vod.doubanId, ''),
    duration: pickPreferredString(vod.duration, ''),
    publishDate: vod.publishDate ? new Date(vod.publishDate) : null,
    note: pickPreferredString(vod.note, ''),
    remarks: pickPreferredString(vod.remarks, ''),
    letter: pickPreferredString(vod.letter, ''),
    status: Number(vod.status || 0),
    hits: Number(vod.hits || 0),
    hitsDay: Number(vod.hitsDay || 0),
    hitsWeek: Number(vod.hitsWeek || 0),
    hitsMonth: Number(vod.hitsMonth || 0)
  });
}

function hasVodChanges(existingVod, nextVod) {
  return JSON.stringify(normalizeVodForComparison(existingVod)) !== JSON.stringify(normalizeVodForComparison(nextVod));
}

function pickPreferredString(incoming, existing) {
  return hasMeaningfulValue(incoming) ? String(incoming).trim() : String(existing || '').trim();
}

function pickPreferredNumber(incoming, existing) {
  return hasMeaningfulValue(incoming) ? Number(incoming) : Number(existing || 0);
}

function pickPreferredBoolean(incoming, existing) {
  return incoming === true || existing === true;
}

function pickPreferredSerial(incoming, existing) {
  const incomingValue = String(incoming || '').trim();
  const existingValue = String(existing || '').trim();
  if (!incomingValue) return existingValue;
  if (!existingValue) return incomingValue;

  const incomingNum = Number(incomingValue);
  const existingNum = Number(existingValue);
  if (Number.isFinite(incomingNum) && Number.isFinite(existingNum)) {
    return String(Math.max(incomingNum, existingNum));
  }
  return incomingValue.length >= existingValue.length ? incomingValue : existingValue;
}

function ensureVodDocumentId(vodData = {}) {
  if (vodData._id !== undefined && vodData._id !== null && String(vodData._id).trim() !== '') {
    return vodData;
  }

  return {
    ...vodData,
    _id: new mongoose.Types.ObjectId()
  };
}

function ensureVodPicture(pic) {
  const value = String(pic || '').trim();
  return value || DEFAULT_POSTER_PATH;
}

function buildIdentityConditions(vodData) {
  const conditions = [];
  const doubanId = String(vodData.doubanId || '').trim();
  const name = String(vodData.name || '').trim();
  const type = vodData.type;
  const year = Number(vodData.year || 0);

  if (doubanId) conditions.push({ doubanId });
  if (name && year > 0) conditions.push({ name, year });
  if (name && type !== undefined && type !== null && type !== '') conditions.push({ name, type });
  if (name) conditions.push({ name });

  return conditions;
}

function buildVodLookupKeys(vodData) {
  const keys = [];
  const doubanId = String(vodData.doubanId || '').trim();
  const name = String(vodData.name || '').trim();
  const year = Number(vodData.year || 0);
  const type = vodData.type === undefined || vodData.type === null ? '' : String(vodData.type);

  if (doubanId) keys.push(`douban:${doubanId}`);
  if (name && year > 0) keys.push(`name-year:${name}::${year}`);
  if (name && type) keys.push(`name-type:${name}::${type}`);
  if (name) keys.push(`name:${name}`);

  return keys;
}

function findBestExistingVod(vodData, existingVods = []) {
  const doubanId = String(vodData.doubanId || '').trim();
  const name = String(vodData.name || '').trim();
  const year = Number(vodData.year || 0);
  const type = vodData.type === undefined || vodData.type === null ? '' : String(vodData.type);

  if (doubanId) {
    const exactDouban = existingVods.find((item) => String(item.doubanId || '').trim() === doubanId);
    if (exactDouban) return exactDouban;
  }

  if (name && year > 0) {
    const exactYear = existingVods.find((item) => String(item.name || '').trim() === name && Number(item.year || 0) === year);
    if (exactYear) return exactYear;
  }

  if (name && type) {
    const exactType = existingVods.find((item) => String(item.name || '').trim() === name && String(item.type || '') === type);
    if (exactType) return exactType;
  }

  if (name) {
    const exactName = existingVods.find((item) => String(item.name || '').trim() === name);
    if (exactName) return exactName;
  }

  return existingVods[0] || null;
}

async function mapWithConcurrency(items, concurrency, iteratee) {
  const limit = Math.max(1, Number(concurrency) || 1);
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await iteratee(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function downloadImageOnce(imgUrl) {
  return new Promise((resolve) => {
    if (!imgUrl || !imgUrl.startsWith('http')) return resolve({ path: '', error: 'invalid image url' });

    let parsedUrl;
    try {
      parsedUrl = new URL(imgUrl);
    } catch (error) {
      return resolve({ path: '', error: error.message || 'invalid image url' });
    }

    const ext = path.extname(parsedUrl.pathname).split('?')[0] || '.jpg';
    const filename = md5(imgUrl) + ext;
    const filePath = path.join(UPLOAD_DIR, filename);
    const relativePath = '/upload/vod/' + filename;

    if (fs.existsSync(filePath)) return resolve({ path: relativePath, error: '' });

    const proto = imgUrl.startsWith('https') ? https : http;
    proto.get(imgUrl, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ path: '', error: `http status ${res.statusCode}` });
      }

      const file = fs.createWriteStream(filePath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ path: relativePath, error: '' });
      });
      file.on('error', () => {
        fs.rm(filePath, { force: true }, () => resolve({ path: '', error: 'write file error' }));
      });
    }).on('error', (error) => resolve({ path: '', error: error.message || 'request error' }))
      .on('timeout', function handleTimeout() {
        this.destroy(new Error('timeout'));
      });
  });
}

async function downloadImageWithRetry(imgUrl, options = {}) {
  const retries = Math.max(0, Number(options.retries) || DEFAULT_IMAGE_RETRY);
  const fallbackPath = String(options.fallbackPath || DEFAULT_POSTER_PATH);
  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await downloadImageOnce(imgUrl);
    if (result.path) {
      return {
        path: result.path,
        usedFallback: false,
        attempts: attempt + 1,
        error: ''
      };
    }
    lastError = result.error || 'download failed';
  }

  return {
    path: fallbackPath,
    usedFallback: true,
    attempts: retries + 1,
    error: lastError
  };
}

function sortTypesById(types = []) {
  return [...types].sort((a, b) => {
    const aId = String(a?.type_id || '');
    const bId = String(b?.type_id || '');
    const aNum = Number(aId);
    const bNum = Number(bId);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return aId.localeCompare(bId, 'zh-Hans-CN');
  });
}

function extractTypesFromItems(list = []) {
  const seen = new Set();
  const types = [];

  for (const item of Array.isArray(list) ? list : []) {
    const typeId = String(item?.type_id || item?.tid || '').trim();
    const typeName = String(item?.type_name || item?.type || '').trim();
    if (!typeId || seen.has(typeId)) continue;
    seen.add(typeId);
    types.push({
      type_id: typeId,
      type_name: typeName
    });
  }

  return sortTypesById(types);
}

function normalizeTopLevelJsonTypes(rawTypes) {
  const list = [];

  if (Array.isArray(rawTypes)) {
    for (const item of rawTypes) {
      if (item === null || item === undefined) continue;
      if (typeof item === 'string') {
        list.push({ type_id: item, type_name: item });
        continue;
      }
      const typeId = String(item.type_id || item.id || item.tid || '').trim();
      const typeName = String(item.type_name || item.type || item.name || '').trim();
      if (!typeId) continue;
      list.push({ type_id: typeId, type_name: typeName });
    }
    return sortTypesById(list);
  }

  if (rawTypes && typeof rawTypes === 'object') {
    for (const [key, value] of Object.entries(rawTypes)) {
      if (value && typeof value === 'object') {
        const typeId = String(value.type_id || value.id || value.tid || key || '').trim();
        const typeName = String(value.type_name || value.type || value.name || '').trim();
        if (!typeId) continue;
        list.push({ type_id: typeId, type_name: typeName });
        continue;
      }

      const typeId = String(key || '').trim();
      const typeName = String(value || '').trim();
      if (!typeId) continue;
      list.push({ type_id: typeId, type_name: typeName });
    }
  }

  return sortTypesById(list);
}

function normalizeXmlTopLevelTypes(rawTypes) {
  let list = rawTypes || [];
  if (!Array.isArray(list)) list = [list].filter(Boolean);

  return sortTypesById(list.map((item) => ({
    type_id: String(item?.id || item?.type_id || item?.tid || item?.$?.id || '').trim(),
    type_name: String(item?._ || item?.name || item?.type_name || '').trim().replace(/<!\[CDATA\[|\]\]>/g, '')
  })).filter((item) => item.type_id));
}

class CollectEngine {
  async run(sourceId, options = {}) {
    const source = await CollectSource.findById(sourceId);
    if (!source || !source.status) throw new Error('采集源未找到或已禁用');

    const range = normalizeCollectRange(options.type);
    const bindings = await CollectTypeBinding.find({ collectSource: sourceId }).lean();
    const bindingMap = new Map(bindings.map((binding) => [String(binding.sourceTypeId), binding]));

    let page = Number(options.startPage || 1);
    let hasMore = true;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let processedCount = 0;

    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

    while (hasMore) {
      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          message: `正在拉取第 ${page} 页列表`,
          log: `开始拉取第 ${page} 页列表`
        });
      }
      const listData = await this.fetchList(source, page, range.hours);
      if (!listData || !Array.isArray(listData.list) || listData.list.length === 0) {
        if (typeof options.onStatus === 'function') {
          await options.onStatus({
            message: processedCount > 0 ? `第 ${page} 页无更多数据` : '本次采集范围暂无数据',
            log: processedCount > 0 ? `第 ${page} 页无更多数据，采集结束` : '本次采集范围暂无数据'
          });
        }
        break;
      }

      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          message: `第 ${page} 页列表获取完成，本页 ${listData.list.length} 条`,
          log: `第 ${page} 页列表获取完成，本页 ${listData.list.length} 条`
        });
      }

      const candidates = listData.list
        .map((item) => {
          const binding = bindingMap.get(getCollectTypeIds(bindingMap, item));
          return {
            item,
            binding,
            sourceVodId: item.vod_id || item.id,
            urlHash: buildCollectUrlHash(item)
          };
        })
        .filter((entry) => {
          if (entry.binding) return true;
          skippedCount++;
          return false;
        });

      if (candidates.length === 0) {
        page++;
        if (listData.pagecount && page > listData.pagecount) hasMore = false;
        continue;
      }

      const historyList = await CollectHistory.find({
        urlHash: { $in: candidates.map((entry) => entry.urlHash) }
      }).lean();
      const historyMap = new Map(historyList.map((entry) => [entry.urlHash, entry]));

      const pending = candidates.filter((entry) => {
        const historyEntry = historyMap.get(entry.urlHash);
        if (!historyEntry) return true;
        if (!source.bind) {
          skippedCount++;
          return false;
        }

        const sourceTime = entry.item.vod_time || entry.item.last || '';
        const historyTime = historyEntry.sourceTime || '';
        if (!sourceTime || sourceTime === historyTime) {
          skippedCount++;
          return false;
        }
        return true;
      });

      if (pending.length === 0) {
        page++;
        if (listData.pagecount && page > listData.pagecount) hasMore = false;
        continue;
      }

      const idsNeedingDetail = pending
        .filter((entry) => !(entry.item.vod_play_url || entry.item.play_url))
        .map((entry) => entry.sourceVodId)
        .filter(Boolean);

      if (idsNeedingDetail.length > 0) {
        try {
          if (typeof options.onStatus === 'function') {
            await options.onStatus({
              message: `正在拉取详情，当前 ${idsNeedingDetail.length} 条`,
              log: `开始拉取详情 ${idsNeedingDetail.length} 条`
            });
          }
          const details = await this.fetchDetail(source, idsNeedingDetail);
          const detailMap = new Map(
            (details || []).map((detail) => [String(detail.vod_id || detail.id || ''), detail])
          );
          for (const entry of pending) {
            const detail = detailMap.get(String(entry.sourceVodId));
            if (detail) entry.item = { ...entry.item, ...detail };
          }
        } catch (error) {
          console.error('Batch detail fetch error:', error.message);
        }
      }

      const prepared = pending.map((entry) => {
        const normalizedVodData = this.normalize(entry.item, entry.binding.localType, source);
        return {
          ...entry,
          vodData: {
            ...normalizedVodData,
            pic: ensureVodPicture(normalizedVodData.pic)
          },
          sourceTime: entry.item.vod_time || entry.item.last || ''
        };
      });

      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          message: `正在处理图片，当前 ${prepared.length} 条`,
          log: `开始处理图片 ${prepared.length} 条`
        });
      }
      await mapWithConcurrency(
        prepared,
        Number(options.imageConcurrency) || DEFAULT_IMAGE_CONCURRENCY,
        async (entry) => {
          if (entry.vodData.pic && entry.vodData.pic.startsWith('http')) {
            try {
              const downloadResult = await downloadImageWithRetry(entry.vodData.pic);
              entry.vodData.pic = downloadResult.path || DEFAULT_POSTER_PATH;
              if (downloadResult.usedFallback && typeof options.onStatus === 'function') {
                await options.onStatus({
                  message: `图片下载失败，已使用默认海报：${entry.vodData.name}`,
                  currentName: entry.vodData.name,
                  log: `图片下载失败(${downloadResult.error || 'unknown'})，重试 ${downloadResult.attempts} 次后使用默认海报：${entry.vodData.name}`
                });
              }
            } catch (error) {
              entry.vodData.pic = DEFAULT_POSTER_PATH;
              console.error('Image download error:', error.message);
              if (typeof options.onStatus === 'function') {
                await options.onStatus({
                  message: `图片处理异常，已使用默认海报：${entry.vodData.name}`,
                  currentName: entry.vodData.name,
                  log: `图片处理异常(${error.message || 'unknown'})，已使用默认海报：${entry.vodData.name}`
                });
              }
            }
          } else {
            entry.vodData.pic = ensureVodPicture(entry.vodData.pic);
          }
        }
      );

      if (typeof options.onStatus === 'function') {
        await options.onStatus({
          message: `正在入库，当前 ${prepared.length} 条`,
          log: `开始入库 ${prepared.length} 条`
        });
      }
      const existingVodMap = await this.findExistingVods(prepared.map((entry) => entry.vodData));

      for (const entry of prepared) {
        const existingVod = this.resolveExistingVod(entry.vodData, existingVodMap);
        let action = 'created';

        if (existingVod) {
          if (!source.bind) {
            await CollectHistory.findOneAndUpdate(
              { urlHash: entry.urlHash },
              {
                urlHash: entry.urlHash,
                collectSource: sourceId,
                vodName: entry.vodData.name,
                sourceTime: entry.sourceTime
              },
              { upsert: true }
            );
            skippedCount++;
            continue;
          }

          const updateDoc = this.mergeVodData(existingVod, entry.vodData);
          if (!hasVodChanges(existingVod, updateDoc)) {
            await CollectHistory.findOneAndUpdate(
              { urlHash: entry.urlHash },
              {
                urlHash: entry.urlHash,
                collectSource: sourceId,
                vodName: entry.vodData.name,
                sourceTime: entry.sourceTime
              },
              { upsert: true }
            );
            skippedCount++;
            continue;
          }
          await Vod.findByIdAndUpdate(existingVod._id, updateDoc);
          updatedCount++;
          action = 'updated';
        } else {
          await Vod.create(ensureVodDocumentId(entry.vodData));
          createdCount++;
        }

        processedCount++;

        await CollectHistory.findOneAndUpdate(
          { urlHash: entry.urlHash },
          {
            urlHash: entry.urlHash,
            collectSource: sourceId,
            vodName: entry.vodData.name,
            sourceTime: entry.sourceTime
          },
          { upsert: true }
        );

        if (typeof options.onProgress === 'function') {
          await options.onProgress({
            page,
            action,
            currentName: entry.vodData.name,
            processed: processedCount,
            created: createdCount,
            updated: updatedCount,
            skipped: skippedCount
          });
        }
      }

      page++;
      if (listData.pagecount && page > listData.pagecount) hasMore = false;
    }

    source.lastCollect = new Date();
    source.collectNum = (source.collectNum || 0) + createdCount + updatedCount;
    await source.save();

    return {
      range: range.key,
      processed: processedCount,
      collected: createdCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      pages: page - 1
    };
  }

  async findExistingVods(vodDataList) {
    const conditions = [];
    const seen = new Set();

    for (const vodData of vodDataList) {
      for (const condition of buildIdentityConditions(vodData)) {
        const key = JSON.stringify(condition);
        if (seen.has(key)) continue;
        seen.add(key);
        conditions.push(condition);
      }
    }

    if (conditions.length === 0) return new Map();

    const existingVods = await Vod.find({ $or: conditions }).lean();
    const lookupMap = new Map();

    for (const vod of existingVods) {
      for (const key of buildVodLookupKeys(vod)) {
        const list = lookupMap.get(key) || [];
        list.push(vod);
        lookupMap.set(key, list);
      }
    }

    return lookupMap;
  }

  resolveExistingVod(vodData, existingVodMap) {
    const candidates = [];
    const seen = new Set();

    for (const key of buildVodLookupKeys(vodData)) {
      const list = existingVodMap.get(key) || [];
      for (const item of list) {
        const id = String(item._id);
        if (seen.has(id)) continue;
        seen.add(id);
        candidates.push(item);
      }
    }

    return findBestExistingVod(vodData, candidates);
  }

  mergeVodData(existingVod, incomingVod) {
    return {
      name: pickPreferredString(incomingVod.name, existingVod.name),
      en: pickPreferredString(incomingVod.en, existingVod.en),
      sub: pickPreferredString(incomingVod.sub, existingVod.sub),
      type: hasMeaningfulValue(incomingVod.type) ? incomingVod.type : existingVod.type,
      actor: pickPreferredString(incomingVod.actor, existingVod.actor),
      director: pickPreferredString(incomingVod.director, existingVod.director),
      writer: pickPreferredString(incomingVod.writer, existingVod.writer),
      pic: pickPreferredString(incomingVod.pic, existingVod.pic),
      content: pickPreferredString(incomingVod.content, existingVod.content),
      playUrls: mergePlayUrls(existingVod.playUrls || [], incomingVod.playUrls || []),
      downUrls: mergePlayUrls(existingVod.downUrls || [], incomingVod.downUrls || []),
      year: pickPreferredNumber(incomingVod.year, existingVod.year),
      area: pickPreferredString(incomingVod.area, existingVod.area),
      lang: pickPreferredString(incomingVod.lang, existingVod.lang),
      class: pickPreferredString(incomingVod.class, existingVod.class),
      tags: mergeTags(existingVod.tags || [], incomingVod.tags || []),
      total: pickPreferredNumber(incomingVod.total, existingVod.total),
      serial: pickPreferredSerial(incomingVod.serial, existingVod.serial),
      isEnd: pickPreferredBoolean(incomingVod.isEnd, existingVod.isEnd),
      score: pickPreferredNumber(incomingVod.score, existingVod.score),
      doubanScore: pickPreferredNumber(incomingVod.doubanScore, existingVod.doubanScore),
      doubanId: pickPreferredString(incomingVod.doubanId, existingVod.doubanId),
      duration: pickPreferredString(incomingVod.duration, existingVod.duration),
      publishDate: incomingVod.publishDate || existingVod.publishDate,
      note: pickPreferredString(incomingVod.note, existingVod.note),
      remarks: pickPreferredString(incomingVod.remarks, existingVod.remarks),
      letter: pickPreferredString(incomingVod.letter, existingVod.letter),
      status: existingVod.status,
      hits: existingVod.hits,
      hitsDay: existingVod.hitsDay,
      hitsWeek: existingVod.hitsWeek,
      hitsMonth: existingVod.hitsMonth
    };
  }

  async fetchList(source, page, hours) {
    const params = { ac: 'list', pg: page };
    if (hours > 0) params.h = hours;
    if (source.appid) params.appid = source.appid;
    if (source.appkey) params.appkey = source.appkey;

    const url = this.buildRequestUrl(source, params);
    const res = await httpClient.get(url);
    const text = await res.text();

    if (source.type === 'xml') return this.parseXmlList(text, page);
    return this.parseJsonList(text, page);
  }

  async fetchTypes(source) {
    const data = await this.fetchList(source, 1, 0);
    if (Array.isArray(data?.types) && data.types.length > 0) return data.types;
    return extractTypesFromItems(data?.list || []);
  }

  async fetchDetail(source, sourceVodIds) {
    const ids = Array.isArray(sourceVodIds) ? sourceVodIds.join(',') : sourceVodIds;
    const params = { ac: 'detail', ids };
    if (source.appid) params.appid = source.appid;
    if (source.appkey) params.appkey = source.appkey;

    const url = this.buildRequestUrl(source, params);
    const res = await httpClient.get(url);
    const text = await res.text();

    if (source.type === 'xml') {
      const data = await this.parseXmlList(text, 1);
      return Array.isArray(sourceVodIds) ? data.list : (data.list[0] || null);
    }

    const data = await this.parseJsonList(text, 1);
    return Array.isArray(sourceVodIds) ? data.list : (data.list[0] || null);
  }

  buildRequestUrl(source, params = {}) {
    const baseUrl = String(source?.url || '').trim();
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') {
        url.searchParams.delete(key);
        continue;
      }
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  parseJsonList(text, page) {
    const json = JSON.parse(text);
    const list = Array.isArray(json.list) ? json.list : [];
    const topLevelTypes = normalizeTopLevelJsonTypes(json.class || json.classes || json.type || json.types);
    const types = topLevelTypes.length > 0 ? topLevelTypes : extractTypesFromItems(list);
    return {
      list,
      types,
      page: parseInt(json.page, 10) || page,
      pagecount: parseInt(json.pagecount, 10) || 1,
      total: parseInt(json.total, 10) || 0
    };
  }

  async parseXmlList(text, page) {
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, trim: true });
    const result = await parser.parseStringPromise(text);
    const root = result.rss || result.maccms || {};
    const listEl = root.list || {};
    const topLevelTypes = normalizeXmlTopLevelTypes(root.class?.ty || root.class?.type || root.ty || []);

    let list = listEl.video || listEl.vod || [];
    if (!Array.isArray(list)) list = [list].filter(Boolean);

    list = list.map((v) => ({
      vod_id: v.id || v.vod_id,
      vod_name: (v.name || v.vod_name || '').replace(/<!\[CDATA\[|\]\]>/g, ''),
      type_id: v.tid || v.type_id,
      type_name: v.type || v.type_name || '',
      vod_remarks: (v.note || v.vod_remarks || '').replace(/<!\[CDATA\[|\]\]>/g, ''),
      vod_time: v.last || v.vod_time || '',
      vod_play_from: v.dt || v.vod_play_from || '',
      pic: v.pic || v.vod_pic || '',
      actor: (v.actor || v.vod_actor || '').replace(/<!\[CDATA\[|\]\]>/g, ''),
      director: (v.director || v.vod_director || '').replace(/<!\[CDATA\[|\]\]>/g, ''),
      area: v.area || v.vod_area || '',
      year: v.year || v.vod_year || '',
      lang: v.lang || v.vod_lang || '',
      content: (v.des || v.vod_content || v.vod_blurb || '').replace(/<!\[CDATA\[|\]\]>/g, ''),
      vod_total: v.vod_total || '',
      vod_isend: v.vod_isend || '0',
      vod_play_url: this.extractXmlPlayUrl(v.dl || v.vod_play_url || ''),
      vod_play_from: this.extractXmlPlayFrom(v.dl || ''),
      note: (v.note || v.vod_remarks || '').replace(/<!\[CDATA\[|\]\]>/g, ''),
      vod_class: v.vod_class || '',
      vod_tag: v.vod_tag || '',
      vod_score: v.vod_score || v.score || 0,
      vod_douban_score: v.vod_douban_score || v.douban_score || 0,
      vod_douban_id: v.vod_douban_id || v.douban_id || ''
    }));

    return {
      list,
      types: topLevelTypes.length > 0 ? topLevelTypes : extractTypesFromItems(list),
      page: parseInt(listEl.page || listEl.$?.page, 10) || page,
      pagecount: parseInt(listEl.pagecount || listEl.$?.pagecount, 10) || 1,
      total: parseInt(listEl.recordcount || listEl.total || listEl.$?.recordcount, 10) || 0
    };
  }

  extractXmlPlayUrl(dl) {
    if (!dl || typeof dl === 'string') return dl || '';
    const dd = dl.dd;
    if (!dd) return '';
    if (typeof dd === 'string') return dd.replace(/<!\[CDATA\[|\]\]>/g, '');
    if (Array.isArray(dd)) return dd.map((d) => (typeof d === 'string' ? d.replace(/<!\[CDATA\[|\]\]>/g, '') : d._ || '')).join('$$$');
    if (typeof dd === 'object') return (dd._ || '').replace(/<!\[CDATA\[|\]\]>/g, '');
    return '';
  }

  extractXmlPlayFrom(dl) {
    if (!dl || typeof dl === 'string') return '';
    const dd = dl.dd;
    if (!dd) return '';
    if (typeof dd === 'object' && !Array.isArray(dd)) return dd.$?.flag || dd.flag || '';
    if (Array.isArray(dd)) return dd.map((d) => (d.$?.flag || d.flag || '')).filter(Boolean).join('$$$');
    return '';
  }

  normalize(item, localTypeId) {
    const remarks = item.vod_remarks || item.note || '';

    return {
      name: item.vod_name || item.name || '',
      en: item.vod_en || item.en || '',
      sub: item.vod_sub || item.sub || item.subname || '',
      type: localTypeId || item.type_id || item.tid || item.type,
      actor: item.vod_actor || item.actor || '',
      director: item.vod_director || item.director || '',
      writer: item.vod_writer || item.writer || '',
      pic: item.vod_pic || item.pic || '',
      content: item.vod_content || item.vod_blurb || item.content || item.des || '',
      year: parseInt(item.vod_year || item.year || 0, 10),
      area: item.vod_area || item.area || '',
      lang: item.vod_lang || item.lang || '',
      class: item.vod_class || item.class || '',
      tags: (item.vod_tag || item.tag || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      total: parseInt(item.vod_total || item.total || 0, 10),
      serial: item.vod_serial || item.serial || '',
      isEnd: (item.vod_isend || item.isend || 0) == 1,
      hits: parseInt(item.vod_hits || item.hits || 0, 10),
      score: parseFloat(item.vod_score || item.score || 0),
      doubanScore: parseFloat(item.vod_douban_score || item.douban_score || 0),
      doubanId: item.vod_douban_id || item.douban_id || '',
      playUrls: Vod.parsePlayUrls(item.vod_play_url || item.play_url || '', item.vod_play_from || item.play_from || ''),
      downUrls: Vod.parsePlayUrls(item.vod_down_url || item.down_url || '', item.vod_down_from || item.down_from || ''),
      duration: item.vod_duration || item.duration || '',
      publishDate: item.vod_time || item.vod_pubdate ? new Date(item.vod_time || item.vod_pubdate) : undefined,
      note: item.vod_note || item.note || '',
      remarks,
      status: 1,
      letter: (item.vod_letter || item.letter || item.vod_name || item.name || '').charAt(0).toUpperCase()
    };
  }
}

const collectEngine = new CollectEngine();
collectEngine.TIME_RANGE = TIME_RANGE;
collectEngine.normalizeCollectRange = normalizeCollectRange;
collectEngine.buildCollectRunOptions = buildCollectRunOptions;
collectEngine.buildCollectUrlHash = buildCollectUrlHash;
collectEngine.DEFAULT_POSTER_PATH = DEFAULT_POSTER_PATH;
collectEngine.downloadImageWithRetry = downloadImageWithRetry;
collectEngine.ensureVodPicture = ensureVodPicture;
collectEngine.ensureVodDocumentId = ensureVodDocumentId;
collectEngine.mergePlayUrls = mergePlayUrls;
collectEngine.hasVodChanges = hasVodChanges;
collectEngine.extractTypesFromItems = extractTypesFromItems;
collectEngine.normalizeTopLevelJsonTypes = normalizeTopLevelJsonTypes;
collectEngine.normalizeXmlTopLevelTypes = normalizeXmlTopLevelTypes;

module.exports = collectEngine;

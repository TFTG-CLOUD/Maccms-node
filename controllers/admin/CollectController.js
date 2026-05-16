const CollectSource = require('../../models/CollectSource');
const CollectTask = require('../../models/CollectTask');
const CollectTypeBinding = require('../../models/CollectTypeBinding');
const Type = require('../../models/Type');
const httpClient = require('../../utils/httpClient');
const collectEngine = require('../../services/CollectEngine');
const collectTaskRunner = require('../../services/CollectTaskRunner');

function normalizeBooleanInput(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'on', 'yes'].includes(normalized);
}

function normalizeTypeBindingId(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' && value._id !== undefined) return String(value._id);
  return String(value);
}

function sortBySourceTypeId(rows = []) {
  return [...rows].sort((a, b) => {
    const aId = String(a?.sourceTypeId || '');
    const bId = String(b?.sourceTypeId || '');
    const aNum = Number(aId);
    const bNum = Number(bId);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return aId.localeCompare(bId, 'zh-Hans-CN');
  });
}

function buildBindingRowsForView(bindings = [], remoteTypes = [], localTypes = []) {
  const bindingMap = new Map(
    bindings.map((binding) => [String(binding.sourceTypeId), binding])
  );
  const typeMap = new Map(localTypes.map((item) => [String(item._id), item]));
  const rows = [];
  const seen = new Set();

  for (const remoteType of remoteTypes) {
    const sourceTypeId = String(remoteType?.type_id || '').trim();
    if (!sourceTypeId || seen.has(sourceTypeId)) continue;
    seen.add(sourceTypeId);

    const binding = bindingMap.get(sourceTypeId) || null;
    const localTypeId = normalizeTypeBindingId(binding?.localType);

    rows.push({
      sourceTypeId,
      sourceTypeName: String(remoteType?.type_name || binding?.sourceTypeName || '').trim(),
      localTypeId,
      localTypeResolved: localTypeId ? typeMap.get(localTypeId) || null : null
    });
  }

  for (const binding of bindings) {
    const sourceTypeId = String(binding.sourceTypeId || '').trim();
    if (!sourceTypeId || seen.has(sourceTypeId)) continue;
    seen.add(sourceTypeId);

    const localTypeId = normalizeTypeBindingId(binding.localType);
    rows.push({
      sourceTypeId,
      sourceTypeName: String(binding.sourceTypeName || '').trim(),
      localTypeId,
      localTypeResolved: localTypeId ? typeMap.get(localTypeId) || null : null
    });
  }

  return sortBySourceTypeId(rows);
}

function normalizeCollectSourceUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const url = new URL(raw);
  const entries = [];
  for (const [key, val] of url.searchParams.entries()) {
    if (val === '') continue;
    entries.push([key, val]);
  }
  entries.sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal, 'en');
    return aKey.localeCompare(bKey, 'en');
  });

  url.search = '';
  for (const [key, val] of entries) {
    url.searchParams.append(key, val);
  }

  return url.toString();
}

function parseCollectSourcePayload(body, existingSource = null) {
  const source = existingSource ? existingSource.toObject ? existingSource.toObject() : existingSource : {};
  const existingFilter = source.filter && typeof source.filter === 'object' ? source.filter : {};

  return {
    name: String(body.name || '').trim(),
    url: normalizeCollectSourceUrl(body.url),
    type: body.type === 'xml' ? 'xml' : 'json',
    mid: 1,
    appid: String(body.appid || '').trim(),
    appkey: String(body.appkey || '').trim(),
    bind: normalizeBooleanInput(body.bind),
    status: normalizeBooleanInput(body.status, true),
    filter: {
      area: String(existingFilter.area || ''),
      year: String(existingFilter.year || ''),
      class: String(existingFilter.class || ''),
      type: Array.isArray(existingFilter.type) ? existingFilter.type : []
    }
  };
}

async function ensureUniqueCollectSource(payload, currentId = null) {
  if (!payload.name) return '采集源名称不能为空';
  if (!payload.url) return '接口地址不能为空';

  let normalizedUrl;
  try {
    normalizedUrl = normalizeCollectSourceUrl(payload.url);
  } catch (error) {
    return '接口地址格式不正确';
  }

  const sources = await CollectSource.find({ mid: 1 }).lean();
  const conflict = sources.find((item) => {
    if (currentId && String(item._id) === String(currentId)) return false;
    try {
      return normalizeCollectSourceUrl(item.url) === normalizedUrl;
    } catch (error) {
      return String(item.url || '').trim() === normalizedUrl;
    }
  });

  return conflict ? '相同接口地址的采集源已存在' : '';
}

function wantsJson(req) {
  return req.xhr
    || req.headers.accept?.includes('application/json')
    || req.headers['content-type']?.includes('application/json');
}

function respondSuccess(req, res, redirect) {
  if (wantsJson(req)) {
    return res.json({ code: 1, msg: 'ok', redirect });
  }
  return res.redirect(redirect);
}

function respondValidationError(req, res, message) {
  if (wantsJson(req)) {
    return res.status(400).json({ code: 0, msg: message });
  }
  return res.status(400).render('error', { message });
}

class CollectController {
  async index(req, res) {
    const list = await CollectSource.find({ mid: 1 }).sort({ updatedAt: -1 }).lean();
    const tasks = await CollectTask.find().sort({ createdAt: -1 }).limit(20).lean();
    res.render('collect/index', { list, tasks });
  }
  async create(req, res) {
    let payload;
    try {
      payload = parseCollectSourcePayload(req.body);
    } catch (error) {
      return respondValidationError(req, res, '接口地址格式不正确');
    }
    const validationError = await ensureUniqueCollectSource(payload);
    if (validationError) return respondValidationError(req, res, validationError);

    await CollectSource.create(payload);
    return respondSuccess(req, res, '/admin/collect');
  }
  async edit(req, res) {
    const source = await CollectSource.findById(req.params.id).lean();
    if (!source) return res.status(404).render('error', { message: '采集源不存在' });
    res.render('collect/edit', { source });
  }
  async update(req, res) {
    const existingSource = await CollectSource.findById(req.params.id);
    if (!existingSource) return respondValidationError(req, res, '采集源不存在');

    let payload;
    try {
      payload = parseCollectSourcePayload(req.body, existingSource);
    } catch (error) {
      return respondValidationError(req, res, '接口地址格式不正确');
    }
    const validationError = await ensureUniqueCollectSource(payload, req.params.id);
    if (validationError) return respondValidationError(req, res, validationError);

    await CollectSource.findByIdAndUpdate(req.params.id, payload);
    return respondSuccess(req, res, '/admin/collect');
  }
  async remove(req, res) {
    await CollectSource.findByIdAndDelete(req.params.id);
    await CollectTypeBinding.deleteMany({ collectSource: req.params.id });
    res.json({ code: 1, msg: 'ok' });
  }
  async test(req, res) {
    const source = await CollectSource.findById(req.params.id);
    if (!source) return res.json({ code: 0, msg: '采集源不存在' });
    try {
      const params = { ac: 'list', pg: 1, h: 24 };
      if (source.appid) params.appid = source.appid;
      if (source.appkey) params.appkey = source.appkey;
      const url = collectEngine.buildRequestUrl(source, params);
      const response = await httpClient.get(url);
      const text = await response.text();
      res.json({ code: 1, msg: '连接成功', data: text.substring(0, 500) });
    } catch (e) {
      res.json({ code: 0, msg: '连接失败: ' + e.message });
    }
  }
  async run(req, res) {
    try {
      const options = collectEngine.buildCollectRunOptions(req.body || {});
      const task = await collectTaskRunner.enqueue({
        sourceId: req.params.id,
        range: options.type,
        trigger: 'manual'
      });
      const message = task.reusedExisting
        ? (task.enqueueMessage || '已有相同采集任务正在执行或等待中')
        : '已加入后台采集任务';
      res.json({ code: 1, msg: message, data: { taskId: task._id || task.id, task } });
    } catch (e) {
      res.json({ code: 0, msg: '采集失败: ' + e.message });
    }
  }
  async tasks(req, res) {
    await collectTaskRunner.failStaleTasks();
    const filter = {};
    if (req.query.sourceId) filter.collectSource = req.query.sourceId;
    const list = await CollectTask.find(filter).sort({ createdAt: -1 }).limit(30).lean();
    res.json({ code: 1, data: list });
  }
  async taskDetail(req, res) {
    const task = await collectTaskRunner.getTask(req.params.taskId);
    if (!task) return res.json({ code: 0, msg: '任务不存在' });
    res.json({ code: 1, data: task });
  }
  async bindings(req, res) {
    const source = await CollectSource.findById(req.params.id).lean();
    if (!source) return res.status(404).render('error', { message: '采集源不存在' });

    const bindings = await CollectTypeBinding.find({ collectSource: req.params.id }).lean();
    const types = await Type.find({ mid: 1 }).sort({ sort: 1, _id: 1 }).lean();

    let remoteTypes = [];
    let remoteTypeError = '';
    try {
      remoteTypes = await collectEngine.fetchTypes(source);
    } catch (error) {
      remoteTypeError = error.message;
    }

    const bindingRows = buildBindingRowsForView(bindings, remoteTypes, types);
    res.render('collect/bindings', {
      source,
      bindings: bindingRows,
      types,
      remoteTypeError
    });
  }
  async saveBindings(req, res) {
    const { bindings: bindingData } = req.body;
    await CollectTypeBinding.deleteMany({ collectSource: req.params.id });
    if (bindingData && Array.isArray(bindingData)) {
      const docs = bindingData.filter(b => b.sourceTypeId && b.localType).map(b => ({
        collectSource: req.params.id,
        sourceTypeId: b.sourceTypeId,
        sourceTypeName: b.sourceTypeName || '',
        localType: b.localType
      }));
      if (docs.length > 0) await CollectTypeBinding.insertMany(docs);
    }
    res.redirect('/admin/collect/' + req.params.id + '/bindings');
  }
}

CollectController.buildBindingRowsForView = buildBindingRowsForView;
CollectController.normalizeCollectSourceUrl = normalizeCollectSourceUrl;
CollectController.parseCollectSourcePayload = parseCollectSourcePayload;
CollectController.ensureUniqueCollectSource = ensureUniqueCollectSource;
CollectController.wantsJson = wantsJson;

module.exports = CollectController;

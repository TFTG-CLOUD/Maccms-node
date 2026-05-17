const Type = require('../../models/Type');
const Vod = require('../../models/Vod');
const CollectTypeBinding = require('../../models/CollectTypeBinding');
const CollectSource = require('../../models/CollectSource');
const FilterAliasSetting = require('../../models/FilterAliasSetting');
const { clearCache } = require('../../middleware/pageCache');
const { clearRuntimeCache } = require('../../utils/runtimeCache');
const { buildMixedIdCandidates, decodeUnicodeText, findOneByMixedId, splitFilterValues } = require('../../utils/front');
const {
  DEFAULT_FILTER_ALIAS_SETTINGS,
  buildAliasLookup,
  getFilterAliasSettings,
  normalizeTypeExtendForStorage
} = require('../../utils/filterAliasConfig');

async function invalidateFrontCaches() {
  await Promise.all([
    clearRuntimeCache('count:'),
    clearRuntimeCache('front:'),
    clearCache()
  ]);
}

function normalizeExtendValue(value) {
  return splitFilterValues(value).join(',');
}

function normalizeExtendObject(extend) {
  const source = extend && typeof extend === 'object' ? extend : {};
  return {
    area: normalizeExtendValue(source.area),
    year: normalizeExtendValue(source.year),
    class: normalizeExtendValue(source.class),
    lang: normalizeExtendValue(source.lang)
  };
}

function normalizeTypeForAdmin(type) {
  if (!type) return type;
  return {
    ...type,
    en: decodeUnicodeText(type.en || ''),
    extend: normalizeExtendObject(type.extend)
  };
}

function normalizeMixedIdInput(value) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function getModuleLabel(mid) {
  if (Number(mid) === 1) return '影视';
  if (Number(mid) === 2) return '文章';
  if (Number(mid) === 8) return '漫画';
  return '其他';
}

function buildParentOptions(types, currentId = null) {
  const currentKey = currentId === null || currentId === undefined ? '' : String(currentId);
  return (types || [])
    .filter((item) => String(item._id) !== currentKey)
    .map((item) => ({
      _id: item._id,
      name: item.name,
      mid: item.mid,
      moduleLabel: getModuleLabel(item.mid),
      isRoot: item.pid === null || item.pid === undefined || item.pid === ''
    }));
}

function parseTypePayload(body, aliasLookup = {}) {
  return {
    name: String(body.name || '').trim(),
    en: String(body.en || '').trim(),
    mid: Number(body.mid || 1),
    pid: normalizeMixedIdInput(body.pid),
    sort: Number(body.sort || 0),
    status: body.status === '0' || body.status === 0 || body.status === false ? false : true,
    tpl: String(body.tpl || '').trim(),
    tplDetail: String(body.tplDetail || '').trim(),
    tplPlay: String(body.tplPlay || '').trim(),
    tplDown: String(body.tplDown || '').trim(),
    logo: String(body.logo || '').trim(),
    extend: normalizeTypeExtendForStorage({
      area: normalizeExtendValue(body.filterArea),
      year: normalizeExtendValue(body.filterYear),
      class: normalizeExtendValue(body.filterClass),
      lang: normalizeExtendValue(body.filterLang)
    }, aliasLookup)
  };
}

async function allocateNextTypeId() {
  const latest = await Type.findOne().sort({ _id: -1 }).select({ _id: 1 }).lean();
  const numericId = Number(latest?._id);
  if (Number.isFinite(numericId)) {
    return numericId + 1;
  }

  const rows = await Type.find({}, { _id: 1 }).lean();
  const maxId = rows.reduce((currentMax, item) => {
    const value = Number(item?._id);
    return Number.isFinite(value) ? Math.max(currentMax, value) : currentMax;
  }, 0);
  return maxId + 1;
}

async function validateTypePayload(payload, currentId = null) {
  if (!payload.name) return '分类名称不能为空';
  if (payload.pid === null) return '';

  if (currentId !== null && currentId !== undefined && String(payload.pid) === String(currentId)) {
    return '父分类不能选择自己';
  }

  const parent = await findOneByMixedId(Type, payload.pid);
  if (!parent) return '父分类不存在';
  if (Number(parent.mid) !== Number(payload.mid)) return '父分类所属模块必须和当前分类一致';

  return '';
}

async function validateTypeRemoval(typeId) {
  const candidates = buildMixedIdCandidates(typeId);
  const child = await Type.findOne({ pid: { $in: candidates } }).lean();
  if (child) {
    return `请先删除或调整子分类：${child.name}`;
  }

  const vod = await Vod.findOne({ type: { $in: candidates } }).lean();
  if (vod) {
    return `该分类已被影视数据引用：${vod.name}`;
  }

  const binding = await CollectTypeBinding.findOne({ localType: { $in: candidates } }).lean();
  if (binding) {
    return '该分类已被采集源分类绑定引用，请先调整分类绑定';
  }

  const collectSource = await CollectSource.findOne({ 'filter.type': { $in: candidates } }).lean();
  if (collectSource) {
    return `该分类已被采集源筛选配置引用：${collectSource.name}`;
  }

  return '';
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

class TypeController {
  async index(req, res) {
    const rawList = await Type.find().sort({ sort: 1 }).lean();
    const typeMap = new Map(rawList.map((item) => [String(item._id), item]));
    const list = rawList.map((item) => {
      const normalized = normalizeTypeForAdmin(item);
      const parent = item.pid === null || item.pid === undefined || item.pid === ''
        ? null
        : typeMap.get(String(item.pid)) || null;
      return {
        ...normalized,
        isRoot: !parent,
        parentName: parent?.name || '',
        moduleLabel: getModuleLabel(item.mid)
      };
    });
    res.render('type/index', { list, parentOptions: buildParentOptions(rawList) });
  }
  async create(req, res) {
    let aliasLookup;
    try {
      aliasLookup = buildAliasLookup(await getFilterAliasSettings(FilterAliasSetting));
    } catch (error) {
      aliasLookup = buildAliasLookup(DEFAULT_FILTER_ALIAS_SETTINGS);
    }
    const payload = parseTypePayload(req.body, aliasLookup);
    const validationError = await validateTypePayload(payload);
    if (validationError) return respondValidationError(req, res, validationError);

    await Type.create({
      _id: await allocateNextTypeId(),
      ...payload
    });
    await invalidateFrontCaches();
    return respondSuccess(req, res, '/admin/type');
  }
  async edit(req, res) {
    const rawType = await findOneByMixedId(Type, req.params.id);
    const type = normalizeTypeForAdmin(rawType);
    if (!type) return res.status(404).render('error', { message: '分类不存在' });
    const allTypes = await Type.find().sort({ sort: 1 }).lean();
    res.render('type/edit', { type, parentOptions: buildParentOptions(allTypes, rawType?._id) });
  }
  async update(req, res) {
    let aliasLookup;
    try {
      aliasLookup = buildAliasLookup(await getFilterAliasSettings(FilterAliasSetting));
    } catch (error) {
      aliasLookup = buildAliasLookup(DEFAULT_FILTER_ALIAS_SETTINGS);
    }
    const payload = parseTypePayload(req.body, aliasLookup);
    const validationError = await validateTypePayload(payload, req.params.id);
    if (validationError) return respondValidationError(req, res, validationError);

    await Type.findOneAndUpdate({ _id: { $in: buildMixedIdCandidates(req.params.id) } }, payload);
    await invalidateFrontCaches();
    return respondSuccess(req, res, '/admin/type');
  }
  async remove(req, res) {
    const validationError = await validateTypeRemoval(req.params.id);
    if (validationError) return respondValidationError(req, res, validationError);

    await Type.findOneAndDelete({ _id: { $in: buildMixedIdCandidates(req.params.id) } });
    await invalidateFrontCaches();
    res.json({ code: 1, msg: 'ok' });
  }
}

TypeController.normalizeMixedIdInput = normalizeMixedIdInput;
TypeController.parseTypePayload = parseTypePayload;
TypeController.validateTypePayload = validateTypePayload;
TypeController.validateTypeRemoval = validateTypeRemoval;
TypeController.buildParentOptions = buildParentOptions;
TypeController.getModuleLabel = getModuleLabel;
TypeController.allocateNextTypeId = allocateNextTypeId;
TypeController.wantsJson = wantsJson;

module.exports = TypeController;

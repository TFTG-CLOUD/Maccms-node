require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const crypto = require('crypto');
const fs = require('fs');
const mongoose = require('mongoose');
const readline = require('readline');
const path = require('path');

const Vod = require('../models/Vod');
const Type = require('../models/Type');
const CollectSource = require('../models/CollectSource');
const CollectTypeBinding = require('../models/CollectTypeBinding');
const SeoSetting = require('../models/SeoSetting');
const { DEFAULT_SEO_SETTINGS, mergeSeoSettings } = require('../utils/seoConfig');
const { splitFilterValues } = require('../utils/front');

const SQL_FILE = '/tmp/cmscms_2026-05-15_00-43-08_mysql_data_3Q3YY.sql';
const LEGACY_DIR = path.join(__dirname, '..', 'old');
const LEGACY_SEO_FILE = path.join(LEGACY_DIR, 'maccms.php');
const LEGACY_BIND_FILE = path.join(LEGACY_DIR, 'bind.php');

function parseIntVal(v) {
  return v === null || v === '' ? 0 : parseInt(v, 10);
}

function parseFloatVal(v) {
  return v === null || v === '' ? 0 : parseFloat(v);
}

function parseSqlRow(cols, valuesStr) {
  const vals = [];
  let current = '';
  let inString = false;
  let depth = 0;
  let justPushed = false;

  for (let i = 0; i < valuesStr.length; i++) {
    const ch = valuesStr[i];
    if (ch === '(') {
      if (!inString) depth++;
      justPushed = false;
      if (!inString) continue;
    }
    if (ch === ')') {
      if (!inString) {
        depth--;
        if (depth === 0) break;
      }
      if (!inString) continue;
    }
    if (ch === '\'' && (i === 0 || valuesStr[i - 1] !== '\\')) {
      inString = !inString;
      if (!inString) {
        vals.push(current);
        current = '';
        justPushed = true;
      }
      continue;
    }
    if (ch === ',' && !inString && depth <= 1) {
      if (!justPushed) vals.push(current);
      current = '';
      justPushed = false;
      continue;
    }
    if (ch !== '\'' || inString) {
      current += ch;
      justPushed = false;
    }
  }
  if (!justPushed && current) vals.push(current);

  vals.forEach((v, idx) => {
    vals[idx] = v.trim()
      .replace(/\\'/g, '\'')
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n');
  });

  const obj = {};
  cols.forEach((col, idx) => {
    const val = vals[idx];
    obj[col] = val === 'NULL' ? null : val;
  });
  return obj;
}

function extractRows(line) {
  const rows = [];
  let idx = 0;

  while (idx < line.length) {
    const openParen = line.indexOf('(', idx);
    if (openParen === -1) break;

    let inString = false;
    let depth = 0;
    let closeIdx = -1;

    for (let i = openParen; i < line.length; i++) {
      const ch = line[i];
      if (ch === '\'' && (i === 0 || line[i - 1] !== '\\')) {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          closeIdx = i;
          break;
        }
      }
    }

    if (closeIdx === -1) break;

    rows.push(line.substring(openParen + 1, closeIdx));
    idx = closeIdx + 1;
  }

  return rows;
}

function normalizeVod(row) {
  const playUrls = Vod.parsePlayUrls(
    row.vod_play_url || '',
    row.vod_play_from || ''
  );

  return {
    _id: parseIntVal(row.vod_id),
    type: parseIntVal(row.type_id),
    typeId1: parseIntVal(row.type_id_1),
    name: row.vod_name || '',
    sub: row.vod_sub || '',
    en: row.vod_en || '',
    status: parseIntVal(row.vod_status),
    letter: row.vod_letter || '',
    color: row.vod_color || '',
    tags: (row.vod_tag || '').split(',').map((t) => t.trim()).filter(Boolean),
    class: row.vod_class || '',
    pic: row.vod_pic || '',
    actor: row.vod_actor || '',
    director: row.vod_director || '',
    writer: row.vod_writer || '',
    content: row.vod_content || '',
    remarks: row.vod_remarks || '',
    total: parseIntVal(row.vod_total),
    serial: row.vod_serial || '',
    area: row.vod_area || '',
    lang: row.vod_lang || '',
    year: row.vod_year || '',
    isEnd: parseIntVal(row.vod_isend) === 1,
    lock: parseIntVal(row.vod_lock),
    level: parseIntVal(row.vod_level),
    copyright: parseIntVal(row.vod_copyright),
    points: parseIntVal(row.vod_points),
    pointsPlay: parseIntVal(row.vod_points_play),
    pointsDown: parseIntVal(row.vod_points_down),
    hits: parseIntVal(row.vod_hits),
    hitsDay: parseIntVal(row.vod_hits_day),
    hitsWeek: parseIntVal(row.vod_hits_week),
    hitsMonth: parseIntVal(row.vod_hits_month),
    score: parseFloatVal(row.vod_score),
    scoreAll: parseIntVal(row.vod_score_all),
    scoreNum: parseIntVal(row.vod_score_num),
    doubanId: row.vod_douban_id || '',
    doubanScore: parseFloatVal(row.vod_douban_score),
    tpl: row.vod_tpl || '',
    tplPlay: row.vod_tpl_play || '',
    tplDown: row.vod_tpl_down || '',
    playUrls,
    duration: row.vod_duration || '',
    note: row.vod_note || '',
    trysee: parseIntVal(row.vod_trysee),
    publishDate: parseIntVal(row.vod_time) ? new Date(parseIntVal(row.vod_time) * 1000) : null,
    createdAt: parseIntVal(row.vod_time_add) ? new Date(parseIntVal(row.vod_time_add) * 1000) : new Date(),
    updatedAt: new Date()
  };
}

function normalizeType(row) {
  let extend = {};
  try {
    if (row.type_extend) extend = JSON.parse(row.type_extend);
  } catch (error) {}

  extend = {
    area: splitFilterValues(extend.area).join(','),
    year: splitFilterValues(extend.year).join(','),
    class: splitFilterValues(extend.class).join(','),
    lang: splitFilterValues(extend.lang).join(',')
  };

  return {
    _id: parseIntVal(row.type_id),
    name: row.type_name || '',
    en: row.type_en || '',
    mid: parseIntVal(row.type_mid),
    pid: parseIntVal(row.type_pid) || null,
    sort: parseIntVal(row.type_sort),
    status: parseIntVal(row.type_status) === 1,
    tpl: row.type_tpl || '',
    tplDetail: row.type_tpl_detail || '',
    tplPlay: row.type_tpl_play || '',
    extend
  };
}

function normalizeCollectSource(row) {
  const collectOpt = parseIntVal(row.collect_opt);
  const localTypes = [];
  return {
    _id: new mongoose.Types.ObjectId(),
    name: row.collect_name || '',
    url: row.collect_url || '',
    type: parseIntVal(row.collect_type) === 1 ? 'xml' : 'json',
    mid: parseIntVal(row.collect_mid) || 1,
    appid: row.collect_appid || '',
    appkey: row.collect_appkey || '',
    filter: {
      area: row.collect_filter_from || '',
      year: row.collect_filter_year || '',
      class: '',
      type: localTypes
    },
    bind: collectOpt !== 1,
    status: true,
    lastCollect: null,
    collectNum: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function parsePhpValue(src, startIndex) {
  let idx = startIndex;
  while (idx < src.length && /[\s\r\n\t,]/.test(src[idx])) idx++;

  if (src.slice(idx, idx + 5) === 'array') {
    idx += 5;
    while (idx < src.length && /\s/.test(src[idx])) idx++;
    if (src[idx] !== '(') throw new Error('Malformed PHP array');
    return parsePhpArrayBody(src, idx + 1);
  }

  if (src[idx] === '\'') {
    idx++;
    let out = '';
    while (idx < src.length) {
      const ch = src[idx];
      if (ch === '\\' && idx + 1 < src.length) {
        const next = src[idx + 1];
        if (next === 'n') out += '\n';
        else if (next === 'r') out += '\r';
        else if (next === 't') out += '\t';
        else out += next;
        idx += 2;
        continue;
      }
      if (ch === '\'') return [out, idx + 1];
      out += ch;
      idx++;
    }
    throw new Error('Unterminated PHP string');
  }

  const numberMatch = src.slice(idx).match(/^-?\d+(?:\.\d+)?/);
  if (numberMatch) {
    const raw = numberMatch[0];
    return [raw.includes('.') ? parseFloat(raw) : parseInt(raw, 10), idx + raw.length];
  }

  const wordMatch = src.slice(idx).match(/^(NULL|null|true|false)/);
  if (wordMatch) {
    const raw = wordMatch[0].toLowerCase();
    if (raw === 'null') return [null, idx + wordMatch[0].length];
    if (raw === 'true') return [true, idx + wordMatch[0].length];
    if (raw === 'false') return [false, idx + wordMatch[0].length];
  }

  throw new Error(`Unsupported PHP value near: ${src.slice(idx, idx + 30)}`);
}

function parsePhpArrayBody(src, startIndex) {
  const out = {};
  let idx = startIndex;

  while (idx < src.length) {
    while (idx < src.length && /[\s\r\n\t,]/.test(src[idx])) idx++;
    if (idx >= src.length) break;
    if (src[idx] === ')') return [out, idx + 1];

    let key;
    if (src[idx] === '\'') {
      [key, idx] = parsePhpValue(src, idx);
    } else {
      const keyMatch = src.slice(idx).match(/^[A-Za-z0-9_]+/);
      if (!keyMatch) throw new Error(`Malformed PHP array key near: ${src.slice(idx, idx + 30)}`);
      key = keyMatch[0];
      idx += key.length;
    }

    while (idx < src.length && /\s/.test(src[idx])) idx++;
    if (src.slice(idx, idx + 2) !== '=>') {
      throw new Error(`Missing => near: ${src.slice(idx, idx + 30)}`);
    }
    idx += 2;

    const [value, nextIdx] = parsePhpValue(src, idx);
    out[key] = value;
    idx = nextIdx;
  }

  return [out, idx];
}

function parsePhpArrayFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const start = content.indexOf('return array');
  if (start === -1) throw new Error(`PHP array not found in ${filePath}`);
  const open = content.indexOf('(', start);
  if (open === -1) throw new Error(`PHP array open paren not found in ${filePath}`);
  const [parsed] = parsePhpArrayBody(content, open + 1);
  return parsed;
}

function parseLegacySeoSettings(legacyConfig) {
  const site = legacyConfig.site || {};
  const seo = legacyConfig.seo || {};

  const pageFromLegacy = (pageKey) => {
    if (!Object.prototype.hasOwnProperty.call(seo, pageKey)) return null;
    const page = seo[pageKey] || {};
    return {
      title: String(page.name || '').trim(),
      keywords: String(page.key || '').trim(),
      description: String(page.des || '').trim()
    };
  };

  return mergeSeoSettings(DEFAULT_SEO_SETTINGS, {
    pages: {
      index: {
        title: String(site.site_name || '').trim(),
        keywords: String(site.site_keywords || '').trim(),
        description: String(site.site_description || '').trim()
      },
      ...(pageFromLegacy('vod') ? { vod: pageFromLegacy('vod') } : {}),
      ...(pageFromLegacy('art') ? { art: pageFromLegacy('art') } : {}),
      ...(pageFromLegacy('actor') ? { actor: pageFromLegacy('actor') } : {}),
      ...(pageFromLegacy('role') ? { role: pageFromLegacy('role') } : {}),
      ...(pageFromLegacy('plot') ? { plot: pageFromLegacy('plot') } : {}),
      ...(pageFromLegacy('website') ? { website: pageFromLegacy('website') } : {})
    }
  });
}

function parseLegacyBindMap(legacyBindConfig) {
  const bindMap = new Map();
  for (const [key, value] of Object.entries(legacyBindConfig || {})) {
    const match = String(key).match(/^([0-9a-f]{32})_(\d+)$/i);
    if (!match) continue;
    bindMap.set(key, {
      sourceHash: match[1].toLowerCase(),
      remoteTypeId: match[2],
      localTypeId: String(value)
    });
  }
  return bindMap;
}

async function bulkUpsert(col, docs) {
  const batch = docs.splice(0, docs.length);
  if (batch.length === 0) return 0;
  const ops = batch.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $setOnInsert: doc },
      upsert: true
    }
  }));
  try {
    await col.bulkWrite(ops, { ordered: false });
  } catch (error) {
    console.error('bulkWrite error:', error.message);
  }
  return batch.length;
}

async function upsertSeoSetting(pages) {
  await SeoSetting.findOneAndUpdate(
    { key: 'default' },
    { $set: { key: 'default', pages } },
    { upsert: true }
  );
}

function findTrackedTable(line) {
  const tables = ['mac_collect', 'mac_type', 'mac_vod'];
  return tables.find((table) => line.includes(`\`${table}\``));
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const typeCol = mongoose.connection.collection('types');
  const vodCol = mongoose.connection.collection('vods');
  const collectCol = mongoose.connection.collection('collectsources');
  const bindingCol = mongoose.connection.collection('collecttypebindings');

  const state = {
    mac_collect: { mode: null, cols: [], buffer: [], count: 0, normalize: normalizeCollectSource, col: collectCol },
    mac_type: { mode: null, cols: [], buffer: [], count: 0, normalize: normalizeType, col: typeCol },
    mac_vod: { mode: null, cols: [], buffer: [], count: 0, normalize: normalizeVod, col: vodCol }
  };

  const sourceHashMap = new Map();

  const rl = readline.createInterface({
    input: fs.createReadStream(SQL_FILE),
    crlfDelay: Infinity
  });

  let activeTable = null;

  const flush = async (tableName) => {
    const tracker = state[tableName];
    if (!tracker || tracker.buffer.length === 0) return;
    tracker.count += await bulkUpsert(tracker.col, tracker.buffer);
    tracker.buffer = [];
    console.log(`${tableName}:`, tracker.count);
  };

  for await (const line of rl) {
    const trackedTable = findTrackedTable(line);

    if (line.includes('CREATE TABLE')) {
      if (activeTable && trackedTable !== activeTable) {
        await flush(activeTable);
        activeTable = null;
      }
      if (trackedTable) {
        activeTable = trackedTable;
        state[activeTable].mode = 'create';
      }
      continue;
    }

    if (line.includes('INSERT INTO')) {
      if (activeTable && trackedTable !== activeTable) {
        await flush(activeTable);
        activeTable = null;
      }
      if (trackedTable) {
        activeTable = trackedTable;
        state[activeTable].mode = 'data';
        const rows = extractRows(line);
        for (const rowStr of rows) {
          try {
            const row = parseSqlRow(state[activeTable].cols, rowStr);
            if (!row) continue;
            if (activeTable === 'mac_type' && row.type_id && row.type_name) {
              state[activeTable].buffer.push(state[activeTable].normalize(row));
            } else if (activeTable === 'mac_vod' && row.vod_id && row.vod_name) {
              state[activeTable].buffer.push(state[activeTable].normalize(row));
            } else if (activeTable === 'mac_collect' && row.collect_id && row.collect_name) {
              const doc = state[activeTable].normalize(row);
              state[activeTable].buffer.push(doc);
              sourceHashMap.set(crypto.createHash('md5').update(doc.url).digest('hex'), doc._id);
            }
          } catch (error) {}
        }
      }
      continue;
    }

    if (activeTable && state[activeTable].mode === 'create' && /^\s+`/.test(line) && !/\b(KEY|PRIMARY|UNIQUE|INDEX|FULLTEXT|SPATIAL)\b/.test(line)) {
      const match = line.match(/`(\w+)`/);
      if (match) state[activeTable].cols.push(match[1]);
      continue;
    }

    if (activeTable && state[activeTable].mode === 'data' && line.startsWith('(')) {
      try {
        const row = parseSqlRow(state[activeTable].cols, line);
        if (activeTable === 'mac_type' && row.type_id && row.type_name) {
          state[activeTable].buffer.push(state[activeTable].normalize(row));
        } else if (activeTable === 'mac_vod' && row.vod_id && row.vod_name) {
          state[activeTable].buffer.push(state[activeTable].normalize(row));
        } else if (activeTable === 'mac_collect' && row.collect_id && row.collect_name) {
          const doc = state[activeTable].normalize(row);
          state[activeTable].buffer.push(doc);
          sourceHashMap.set(crypto.createHash('md5').update(doc.url).digest('hex'), doc._id);
        }
      } catch (error) {}
    }
  }

  await flush('mac_collect');
  await flush('mac_type');
  await flush('mac_vod');

  const types = await Type.find().lean();
  const typeIdSet = new Set(types.map((type) => String(type._id)));
  const bindConfig = parseLegacyBindMap(parsePhpArrayFile(LEGACY_BIND_FILE));
  const bindingDocs = [];
  const sourceTypeIdsBySource = new Map();

  for (const binding of bindConfig.values()) {
    if (!sourceHashMap.has(binding.sourceHash)) continue;
    if (!typeIdSet.has(binding.localTypeId)) continue;
    const collectSourceId = sourceHashMap.get(binding.sourceHash);
    bindingDocs.push({
      collectSource: collectSourceId,
      sourceTypeId: binding.remoteTypeId,
      sourceTypeName: '',
      localType: binding.localTypeId
    });

    if (!sourceTypeIdsBySource.has(String(collectSourceId))) {
      sourceTypeIdsBySource.set(String(collectSourceId), new Set());
    }
    sourceTypeIdsBySource.get(String(collectSourceId)).add(binding.localTypeId);
  }

  if (bindingDocs.length > 0) {
    const ops = bindingDocs.map((doc) => ({
      updateOne: {
        filter: { collectSource: doc.collectSource, sourceTypeId: doc.sourceTypeId },
        update: { $setOnInsert: doc },
        upsert: true
      }
    }));
    try {
      await bindingCol.bulkWrite(ops, { ordered: false });
    } catch (error) {
      console.error('binding bulkWrite error:', error.message);
    }
  }

  const sourceUpdates = [];
  for (const [sourceId, typeIds] of sourceTypeIdsBySource.entries()) {
    sourceUpdates.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(sourceId) },
        update: {
          $set: {
            'filter.type': Array.from(typeIds)
          }
        }
      }
    });
  }
  if (sourceUpdates.length > 0) {
    try {
      await collectCol.bulkWrite(sourceUpdates, { ordered: false });
    } catch (error) {
      console.error('collect source update error:', error.message);
    }
  }

  const legacySeo = parseLegacySeoSettings(parsePhpArrayFile(LEGACY_SEO_FILE));
  await upsertSeoSetting(legacySeo);

  console.log('\nMigration complete!');
  console.log('Types migrated:', state.mac_type.count);
  console.log('Vods migrated:', state.mac_vod.count);
  console.log('Collect sources migrated:', state.mac_collect.count);
  console.log('Bindings migrated:', bindingDocs.length);

  console.log('Total types in DB:', await typeCol.countDocuments());
  console.log('Total vods in DB:', await vodCol.countDocuments());
  console.log('Total collect sources in DB:', await collectCol.countDocuments());
  console.log('Total bindings in DB:', await bindingCol.countDocuments());

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  extractRows,
  parseLegacyBindMap,
  parseLegacySeoSettings,
  parsePhpArrayBody,
  parsePhpArrayFile,
  parsePhpValue,
  parseSqlRow,
  normalizeCollectSource,
  normalizeType,
  normalizeVod
};

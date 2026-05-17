require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Vod = require('../models/Vod');
const Type = require('../models/Type');
const FilterAliasSetting = require('../models/FilterAliasSetting');
const { closeRedisClient } = require('../services/RedisClient');
const {
  applyVodFilterMetadata,
  buildAliasLookup,
  getFilterAliasSettings,
  normalizeTypeExtendForStorage
} = require('../utils/filterAliasConfig');

const BATCH_SIZE = Math.max(1, Number(process.env.FILTER_TOKEN_MIGRATE_BATCH_SIZE || 500));

function hasSameArray(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function normalizeCurrentArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function normalizeExtendShape(extend = {}) {
  const source = extend && typeof extend === 'object' ? extend : {};
  return {
    area: String(source.area || '').trim(),
    year: String(source.year || '').trim(),
    class: String(source.class || '').trim(),
    lang: String(source.lang || '').trim()
  };
}

async function migrateVodTokens(aliasLookup, { dryRun = false } = {}) {
  let scanned = 0;
  let changed = 0;
  let batch = [];
  const cursor = Vod.find({}, {
    area: 1,
    class: 1,
    lang: 1,
    actor: 1,
    director: 1,
    writer: 1,
    year: 1,
    areaTokens: 1,
    classTokens: 1,
    langTokens: 1,
    actorTokens: 1,
    directorTokens: 1,
    writerTokens: 1,
    filterTokens: 1
  }).cursor();

  for await (const vod of cursor) {
    scanned += 1;
    const next = applyVodFilterMetadata({
      area: vod.area,
      class: vod.class,
      lang: vod.lang,
      actor: vod.actor,
      director: vod.director,
      writer: vod.writer,
      year: vod.year
    }, aliasLookup);

    const needUpdate = !hasSameArray(normalizeCurrentArray(vod.areaTokens), next.areaTokens)
      || !hasSameArray(normalizeCurrentArray(vod.classTokens), next.classTokens)
      || !hasSameArray(normalizeCurrentArray(vod.langTokens), next.langTokens)
      || !hasSameArray(normalizeCurrentArray(vod.actorTokens), next.actorTokens)
      || !hasSameArray(normalizeCurrentArray(vod.directorTokens), next.directorTokens)
      || !hasSameArray(normalizeCurrentArray(vod.writerTokens), next.writerTokens)
      || !hasSameArray(normalizeCurrentArray(vod.filterTokens), next.filterTokens);

    if (!needUpdate) continue;
    changed += 1;
    batch.push({
      updateOne: {
        filter: { _id: vod._id },
        update: {
          $set: {
            areaTokens: next.areaTokens,
            classTokens: next.classTokens,
            langTokens: next.langTokens,
            actorTokens: next.actorTokens,
            directorTokens: next.directorTokens,
            writerTokens: next.writerTokens,
            filterTokens: next.filterTokens
          }
        }
      }
    });

    if (!dryRun && batch.length >= BATCH_SIZE) {
      await Vod.bulkWrite(batch, { ordered: false });
      batch = [];
    }

    if (scanned % 500 === 0) {
      console.log(`vod scanned: ${scanned}, changed: ${changed}`);
    }
  }

  if (!dryRun && batch.length > 0) {
    await Vod.bulkWrite(batch, { ordered: false });
  }

  return { scanned, changed };
}

async function migrateTypeExtends(aliasLookup, { dryRun = false } = {}) {
  const list = await Type.find({}, { extend: 1 }).lean();
  let changed = 0;
  const operations = [];

  for (const type of list) {
    const currentExtend = normalizeExtendShape(type.extend);
    const nextExtend = normalizeTypeExtendForStorage(currentExtend, aliasLookup);
    const same = currentExtend.area === nextExtend.area
      && currentExtend.year === nextExtend.year
      && currentExtend.class === nextExtend.class
      && currentExtend.lang === nextExtend.lang;

    if (same) continue;
    changed += 1;
    operations.push({
      updateOne: {
        filter: { _id: type._id },
        update: { $set: { extend: { ...(type.extend || {}), ...nextExtend } } }
      }
    });
  }

  if (!dryRun && operations.length > 0) {
    while (operations.length > 0) {
      await Type.bulkWrite(operations.splice(0, BATCH_SIZE), { ordered: false });
    }
  }

  return { scanned: list.length, changed };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const aliasLookup = buildAliasLookup(await getFilterAliasSettings(FilterAliasSetting));
    const vodResult = await migrateVodTokens(aliasLookup, { dryRun });
    const typeResult = await migrateTypeExtends(aliasLookup, { dryRun });

    console.log(`mode: ${dryRun ? 'dry-run' : 'write'}`);
    console.log(`vod scanned: ${vodResult.scanned}`);
    console.log(`vod changed: ${vodResult.changed}`);
    console.log(`type scanned: ${typeResult.scanned}`);
    console.log(`type changed: ${typeResult.changed}`);
  } finally {
    await mongoose.disconnect();
    await closeRedisClient();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  migrateTypeExtends,
  migrateVodTokens
};

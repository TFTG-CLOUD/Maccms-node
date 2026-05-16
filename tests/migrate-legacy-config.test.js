const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  bulkUpsert,
  iterateSqlRows,
  parseLegacyBindMap,
  parseLegacySeoSettings,
  parsePhpArrayFile
} = require('../scripts/migrate');

test('parsePhpArrayFile reads nested php array config', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maccms-legacy-'));
  const file = path.join(dir, 'config.php');
  fs.writeFileSync(file, `<?php
return array (
  'site' => array (
    'site_name' => '唐诡影视',
    'site_keywords' => '唐诡影视站',
    'site_description' => '描述',
  ),
  'seo' => array (
    'vod' => array (
      'name' => '影片页',
      'key' => '关键词',
      'des' => '说明',
    ),
  ),
);
`);

  const parsed = parsePhpArrayFile(file);
  assert.equal(parsed.site.site_name, '唐诡影视');
  assert.equal(parsed.seo.vod.name, '影片页');
});

test('parseLegacySeoSettings maps legacy site and seo values', () => {
  const merged = parseLegacySeoSettings({
    site: {
      site_name: '唐诡影视',
      site_keywords: '唐诡影视站',
      site_description: '描述'
    },
    seo: {
      vod: {
        name: '影片页',
        key: '关键词',
        des: '说明'
      },
      actor: {
        name: '演员页',
        key: '演员关键词',
        des: '演员说明'
      }
    }
  });

  assert.equal(merged.index.title, '唐诡影视');
  assert.equal(merged.vod.title, '影片页');
  assert.equal(merged.vod.keywords, '关键词');
  assert.equal(merged.actor.description, '演员说明');
  assert.equal(merged.role.title, '{siteTitle} - 角色');
});

test('parseLegacyBindMap keeps md5 collect url bindings', () => {
  const map = parseLegacyBindMap({
    '7a4856e7b6a1e1a2580a9b69cdc7233c_5': 6,
    invalid: 1
  });

  assert.equal(map.size, 1);
  assert.equal(map.get('7a4856e7b6a1e1a2580a9b69cdc7233c_5').remoteTypeId, '5');
  assert.equal(map.get('7a4856e7b6a1e1a2580a9b69cdc7233c_5').localTypeId, '6');
});

test('bulkUpsert splits writes into smaller batches', async () => {
  const calls = [];
  const mockCollection = {
    async bulkWrite(ops) {
      calls.push(ops.length);
    }
  };

  const docs = Array.from({ length: 1200 }, (_, index) => ({ _id: index + 1 }));
  const count = await bulkUpsert(mockCollection, docs, 500);

  assert.equal(count, 1200);
  assert.deepEqual(calls, [500, 500, 200]);
});

test('iterateSqlRows streams rows from multi-value insert lines', () => {
  const rows = Array.from(iterateSqlRows("INSERT INTO `mac_vod` VALUES (1,'A, B (test)'),(2,'C');"));

  assert.deepEqual(rows, ["1,'A, B (test)'", "2,'C'"]);
});

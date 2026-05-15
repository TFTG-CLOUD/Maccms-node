const test = require('node:test');
const assert = require('node:assert/strict');

const CollectSource = require('../models/CollectSource');
const CollectTypeBinding = require('../models/CollectTypeBinding');
const collectEngine = require('../services/CollectEngine');

test('collect engine completes successfully when the source has no data in the selected range', async (t) => {
  const originalFindById = CollectSource.findById.bind(CollectSource);
  const originalBindingsFind = CollectTypeBinding.find.bind(CollectTypeBinding);
  const originalFetchList = collectEngine.fetchList;

  t.after(() => {
    CollectSource.findById = originalFindById;
    CollectTypeBinding.find = originalBindingsFind;
    collectEngine.fetchList = originalFetchList;
  });

  CollectSource.findById = async () => ({
    _id: 'source-1',
    name: '空数据源',
    status: true,
    bind: true,
    collectNum: 0,
    save: async function save() {
      return this;
    }
  });
  CollectTypeBinding.find = () => ({
    lean: async () => []
  });
  collectEngine.fetchList = async () => ({
    list: [],
    page: 1,
    pagecount: 1,
    total: 0
  });

  const statusLogs = [];
  const result = await collectEngine.run('source-1', {
    type: '1day',
    onStatus: async (status) => {
      statusLogs.push(status.log || status.message || '');
    }
  });

  assert.equal(result.processed, 0);
  assert.equal(result.created, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.pages, 0);
  assert.equal(statusLogs.includes('本次采集范围暂无数据'), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const CollectSource = require('../models/CollectSource');
const CollectTypeBinding = require('../models/CollectTypeBinding');
const CollectHistory = require('../models/CollectHistory');
const Vod = require('../models/Vod');
const collectEngine = require('../services/CollectEngine');

test('collect engine skips updating an existing vod when merged data is unchanged', async (t) => {
  const originalFindById = CollectSource.findById.bind(CollectSource);
  const originalBindingsFind = CollectTypeBinding.find.bind(CollectTypeBinding);
  const originalHistoryFind = CollectHistory.find.bind(CollectHistory);
  const originalHistoryUpsert = CollectHistory.findOneAndUpdate.bind(CollectHistory);
  const originalVodFind = Vod.find.bind(Vod);
  const originalVodUpdate = Vod.findByIdAndUpdate.bind(Vod);
  const originalVodCreate = Vod.create.bind(Vod);
  const originalFetchList = collectEngine.fetchList;
  const originalNormalize = collectEngine.normalize.bind(collectEngine);

  t.after(() => {
    CollectSource.findById = originalFindById;
    CollectTypeBinding.find = originalBindingsFind;
    CollectHistory.find = originalHistoryFind;
    CollectHistory.findOneAndUpdate = originalHistoryUpsert;
    Vod.find = originalVodFind;
    Vod.findByIdAndUpdate = originalVodUpdate;
    Vod.create = originalVodCreate;
    collectEngine.fetchList = originalFetchList;
    collectEngine.normalize = originalNormalize;
  });

  const existingVod = {
    _id: 'vod-1',
    name: '测试影片',
    type: 44,
    actor: '演员A',
    director: '导演A',
    writer: '',
    pic: '/upload/vod/demo.jpg',
    content: '剧情简介',
    playUrls: [
      {
        server: 'wjm3u8',
        episodes: [
          { nid: 1, name: '第01集', url: 'https://a.com/1.m3u8' }
        ]
      }
    ],
    downUrls: [],
    year: 2025,
    area: '中国大陆',
    lang: '',
    class: '剧情',
    tags: ['剧情'],
    total: 1,
    serial: '1',
    isEnd: true,
    score: 8.2,
    doubanScore: 7.8,
    doubanId: 'db-1',
    duration: '',
    publishDate: new Date('2026-05-16T00:00:00.000Z'),
    note: '',
    remarks: '更新至1集',
    letter: 'C',
    status: 1,
    hits: 10,
    hitsDay: 1,
    hitsWeek: 2,
    hitsMonth: 3
  };

  CollectSource.findById = async () => ({
    _id: 'source-1',
    name: '测试源',
    status: true,
    bind: true,
    collectNum: 0,
    save: async function save() {
      return this;
    }
  });
  CollectTypeBinding.find = () => ({
    lean: async () => [
      { sourceTypeId: '2', localType: 44 }
    ]
  });
  CollectHistory.find = () => ({
    lean: async () => []
  });
  CollectHistory.findOneAndUpdate = async () => ({ ok: 1 });
  collectEngine.fetchList = async () => ({
    list: [
      {
        vod_id: 'remote-1',
        type_id: '2',
        vod_name: '测试影片',
        vod_time: '2026-05-16 00:00:00',
        vod_play_url: '第01集$https://a.com/1.m3u8',
        vod_play_from: 'wjm3u8'
      }
    ],
    page: 1,
    pagecount: 1,
    total: 1
  });
  collectEngine.normalize = () => ({
    name: '测试影片',
    type: 44,
    actor: '演员A',
    director: '导演A',
    writer: '',
    pic: '/upload/vod/demo.jpg',
    content: '剧情简介',
    playUrls: [
      {
        server: 'wjm3u8',
        episodes: [
          { nid: 1, name: '第01集', url: 'https://a.com/1.m3u8' }
        ]
      }
    ],
    downUrls: [],
    year: 2025,
    area: '中国大陆',
    lang: '',
    class: '剧情',
    tags: ['剧情'],
    total: 1,
    serial: '1',
    isEnd: true,
    score: 8.2,
    doubanScore: 7.8,
    doubanId: 'db-1',
    duration: '',
    publishDate: new Date('2026-05-16T00:00:00.000Z'),
    note: '',
    remarks: '更新至1集',
    status: 1,
    letter: 'C'
  });

  let updateCalled = false;
  Vod.find = () => ({
    lean: async () => [existingVod]
  });
  Vod.findByIdAndUpdate = async () => {
    updateCalled = true;
    return existingVod;
  };
  Vod.create = async () => {
    throw new Error('should not create a new vod');
  };

  const result = await collectEngine.run('source-1', { type: 'today' });

  assert.equal(updateCalled, false);
  assert.equal(result.created, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.skipped, 1);
  assert.equal(result.processed, 0);
});

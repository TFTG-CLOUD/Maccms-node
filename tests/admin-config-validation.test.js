const test = require('node:test');
const assert = require('node:assert/strict');

const Type = require('../models/Type');
const Vod = require('../models/Vod');
const CollectTypeBinding = require('../models/CollectTypeBinding');
const CollectSource = require('../models/CollectSource');
const TypeController = require('../controllers/admin/TypeController');
const CollectController = require('../controllers/admin/CollectController');

test('parseTypePayload normalizes numeric pid values', () => {
  const payload = TypeController.parseTypePayload({
    name: '动作片',
    mid: '1',
    pid: '20',
    sort: '9',
    status: '1',
    filterArea: '大陆,美国'
  });

  assert.equal(payload.pid, 20);
  assert.equal(payload.mid, 1);
  assert.equal(payload.sort, 9);
  assert.equal(payload.extend.area, '大陆,美国');
});

test('validateTypePayload rejects self parent and cross-module parent', async (t) => {
  const originalFindOne = Type.findOne.bind(Type);

  t.after(() => {
    Type.findOne = originalFindOne;
  });

  Type.findOne = (query) => ({
    lean: async () => {
      const id = query?._id?.$in?.[0];
      if (String(id) === '20') return { _id: 20, name: '电影', mid: 1 };
      if (String(id) === '200') return { _id: 200, name: '文章分类', mid: 2 };
      return null;
    }
  });

  assert.equal(
    await TypeController.validateTypePayload({ name: '测试', mid: 1, pid: 20 }, 20),
    '父分类不能选择自己'
  );
  assert.equal(
    await TypeController.validateTypePayload({ name: '测试', mid: 1, pid: 200 }),
    '父分类所属模块必须和当前分类一致'
  );
  assert.equal(
    await TypeController.validateTypePayload({ name: '测试', mid: 1, pid: 20 }),
    ''
  );
});

test('buildParentOptions excludes current type and annotates module labels', () => {
  const options = TypeController.buildParentOptions([
    { _id: 20, name: '电影', mid: 1, pid: null },
    { _id: 24, name: '动作片', mid: 1, pid: 20 },
    { _id: 90, name: '文章', mid: 2, pid: null }
  ], 24);

  assert.deepEqual(options, [
    { _id: 20, name: '电影', mid: 1, moduleLabel: '影视', isRoot: true },
    { _id: 90, name: '文章', mid: 2, moduleLabel: '文章', isRoot: true }
  ]);
});

test('allocateNextTypeId returns the next numeric category id', async (t) => {
  const originalFindOne = Type.findOne.bind(Type);

  t.after(() => {
    Type.findOne = originalFindOne;
  });

  Type.findOne = () => ({
    sort: () => ({
      select: () => ({
        lean: async () => ({ _id: 90 })
      })
    })
  });

  assert.equal(await TypeController.allocateNextTypeId(), 91);
});

test('validateTypeRemoval blocks deleting a parent category with children', async (t) => {
  const originalFindOne = Type.findOne.bind(Type);
  const originalVodFindOne = Vod.findOne.bind(Vod);
  const originalBindingFindOne = CollectTypeBinding.findOne.bind(CollectTypeBinding);
  const originalSourceFindOne = CollectSource.findOne.bind(CollectSource);

  t.after(() => {
    Type.findOne = originalFindOne;
    Vod.findOne = originalVodFindOne;
    CollectTypeBinding.findOne = originalBindingFindOne;
    CollectSource.findOne = originalSourceFindOne;
  });

  Type.findOne = () => ({
    lean: async () => ({ _id: 24, name: '动作片', pid: 20 })
  });
  Vod.findOne = () => ({ lean: async () => null });
  CollectTypeBinding.findOne = () => ({ lean: async () => null });
  CollectSource.findOne = () => ({ lean: async () => null });

  assert.equal(
    await TypeController.validateTypeRemoval(20),
    '请先删除或调整子分类：动作片'
  );
});

test('validateTypeRemoval allows deleting leaf categories', async (t) => {
  const originalFindOne = Type.findOne.bind(Type);
  const originalVodFindOne = Vod.findOne.bind(Vod);
  const originalBindingFindOne = CollectTypeBinding.findOne.bind(CollectTypeBinding);
  const originalSourceFindOne = CollectSource.findOne.bind(CollectSource);

  t.after(() => {
    Type.findOne = originalFindOne;
    Vod.findOne = originalVodFindOne;
    CollectTypeBinding.findOne = originalBindingFindOne;
    CollectSource.findOne = originalSourceFindOne;
  });

  Type.findOne = () => ({
    lean: async () => null
  });
  Vod.findOne = () => ({ lean: async () => null });
  CollectTypeBinding.findOne = () => ({ lean: async () => null });
  CollectSource.findOne = () => ({ lean: async () => null });

  assert.equal(
    await TypeController.validateTypeRemoval(24),
    ''
  );
});

test('validateTypeRemoval blocks deleting a category referenced by vod data', async (t) => {
  const originalFindOne = Type.findOne.bind(Type);
  const originalVodFindOne = Vod.findOne.bind(Vod);
  const originalBindingFindOne = CollectTypeBinding.findOne.bind(CollectTypeBinding);
  const originalSourceFindOne = CollectSource.findOne.bind(CollectSource);

  t.after(() => {
    Type.findOne = originalFindOne;
    Vod.findOne = originalVodFindOne;
    CollectTypeBinding.findOne = originalBindingFindOne;
    CollectSource.findOne = originalSourceFindOne;
  });

  Type.findOne = () => ({ lean: async () => null });
  Vod.findOne = () => ({ lean: async () => ({ _id: 1, name: '示例影片', type: 24 }) });
  CollectTypeBinding.findOne = () => ({ lean: async () => null });
  CollectSource.findOne = () => ({ lean: async () => null });

  assert.equal(
    await TypeController.validateTypeRemoval(24),
    '该分类已被影视数据引用：示例影片'
  );
});

test('validateTypeRemoval blocks deleting a category referenced by collect bindings', async (t) => {
  const originalFindOne = Type.findOne.bind(Type);
  const originalVodFindOne = Vod.findOne.bind(Vod);
  const originalBindingFindOne = CollectTypeBinding.findOne.bind(CollectTypeBinding);
  const originalSourceFindOne = CollectSource.findOne.bind(CollectSource);

  t.after(() => {
    Type.findOne = originalFindOne;
    Vod.findOne = originalVodFindOne;
    CollectTypeBinding.findOne = originalBindingFindOne;
    CollectSource.findOne = originalSourceFindOne;
  });

  Type.findOne = () => ({ lean: async () => null });
  Vod.findOne = () => ({ lean: async () => null });
  CollectTypeBinding.findOne = () => ({ lean: async () => ({ _id: 'b1', localType: 24 }) });
  CollectSource.findOne = () => ({ lean: async () => null });

  assert.equal(
    await TypeController.validateTypeRemoval(24),
    '该分类已被采集源分类绑定引用，请先调整分类绑定'
  );
});

test('validateTypeRemoval blocks deleting a category referenced by collect source filters', async (t) => {
  const originalFindOne = Type.findOne.bind(Type);
  const originalVodFindOne = Vod.findOne.bind(Vod);
  const originalBindingFindOne = CollectTypeBinding.findOne.bind(CollectTypeBinding);
  const originalSourceFindOne = CollectSource.findOne.bind(CollectSource);

  t.after(() => {
    Type.findOne = originalFindOne;
    Vod.findOne = originalVodFindOne;
    CollectTypeBinding.findOne = originalBindingFindOne;
    CollectSource.findOne = originalSourceFindOne;
  });

  Type.findOne = () => ({ lean: async () => null });
  Vod.findOne = () => ({ lean: async () => null });
  CollectTypeBinding.findOne = () => ({ lean: async () => null });
  CollectSource.findOne = () => ({ lean: async () => ({ _id: 's1', name: '魔都' }) });

  assert.equal(
    await TypeController.validateTypeRemoval(24),
    '该分类已被采集源筛选配置引用：魔都'
  );
});

test('normalizeCollectSourceUrl sorts query params and keeps canonical form', () => {
  const normalized = CollectController.normalizeCollectSourceUrl('https://example.com/api.php/provide/vod/?pg=1&ac=list&h=24');
  assert.equal(normalized, 'https://example.com/api.php/provide/vod/?ac=list&h=24&pg=1');
});

test('parseCollectSourcePayload preserves existing filter config', () => {
  const payload = CollectController.parseCollectSourcePayload({
    name: '魔都',
    url: 'https://example.com/api.php/provide/vod/?ac=list',
    type: 'json',
    bind: '1',
    status: '1'
  }, {
    filter: {
      area: '大陆',
      year: '2025',
      class: '动作',
      type: [24, 25]
    }
  });

  assert.deepEqual(payload.filter, {
    area: '大陆',
    year: '2025',
    class: '动作',
    type: [24, 25]
  });
});

test('ensureUniqueCollectSource rejects duplicated normalized urls', async (t) => {
  const originalFind = CollectSource.find.bind(CollectSource);

  t.after(() => {
    CollectSource.find = originalFind;
  });

  CollectSource.find = () => ({
    lean: async () => ([
      { _id: 'a', mid: 1, url: 'https://example.com/api.php/provide/vod/?ac=list&pg=1' }
    ])
  });

  assert.equal(
    await CollectController.ensureUniqueCollectSource({
      name: '重复源',
      url: 'https://example.com/api.php/provide/vod/?pg=1&ac=list'
    }),
    '相同接口地址的采集源已存在'
  );

  assert.equal(
    await CollectController.ensureUniqueCollectSource({
      name: '当前源',
      url: 'https://example.com/api.php/provide/vod/?pg=1&ac=list'
    }, 'a'),
    ''
  );
});

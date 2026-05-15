const test = require('node:test');
const assert = require('node:assert/strict');

const CollectController = require('../controllers/admin/CollectController');
const collectEngine = require('../services/CollectEngine');

test('buildBindingRowsForView keeps saved local type ids and fills remote names', () => {
  const rows = CollectController.buildBindingRowsForView(
    [
      { sourceTypeId: '10', sourceTypeName: '', localType: '24' },
      { sourceTypeId: '11', sourceTypeName: '', localType: '25' },
      { sourceTypeId: '1', sourceTypeName: '', localType: '58' }
    ],
    [
      { type_id: '1', type_name: '国产动漫' },
      { type_id: '10', type_name: '动作片' },
      { type_id: '11', type_name: '喜剧片' }
    ],
    [
      { _id: 24, name: '动作片' },
      { _id: 25, name: '喜剧片' },
      { _id: 58, name: '国产动漫' }
    ]
  );

  assert.deepEqual(rows, [
    {
      sourceTypeId: '1',
      sourceTypeName: '国产动漫',
      localTypeId: '58',
      localTypeResolved: { _id: 58, name: '国产动漫' }
    },
    {
      sourceTypeId: '10',
      sourceTypeName: '动作片',
      localTypeId: '24',
      localTypeResolved: { _id: 24, name: '动作片' }
    },
    {
      sourceTypeId: '11',
      sourceTypeName: '喜剧片',
      localTypeId: '25',
      localTypeResolved: { _id: 25, name: '喜剧片' }
    }
  ]);
});

test('buildRequestUrl preserves existing query params while overriding collect params', () => {
  const url = collectEngine.buildRequestUrl(
    { url: 'https://www.mdzyapi.com/api.php/provide/vod/?ac=list' },
    { ac: 'list', pg: 2, h: 24 }
  );

  assert.equal(
    url,
    'https://www.mdzyapi.com/api.php/provide/vod/?ac=list&pg=2&h=24'
  );
});

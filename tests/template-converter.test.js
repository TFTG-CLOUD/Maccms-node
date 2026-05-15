const test = require('node:test');
const assert = require('node:assert/strict');

const { convertTemplate } = require('../tools/template-converter');

test('template converter emits macUrl helpers for migrated internal routes', () => {
  const source = `
<a class="logo" href="{$maccms.path}"></a>
<form method="get" action="{:mac_url('vod/search')}"></form>
<a href="{:mac_url_vod_detail($vo)}" title="{$vo.vod_name}"></a>
`;

  const { pug } = convertTemplate(source, 'sample.html');

  assert.match(pug, /href=macUrl\("\/"\)/);
  assert.match(pug, /action=macUrl\('\/vod\/search\.html'\)/);
  assert.match(pug, /href=macUrl\(`\/vod\/detail\/id\/\$\{item\._id\}\.html`\)/);
});

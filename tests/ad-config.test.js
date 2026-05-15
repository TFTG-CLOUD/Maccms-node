const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_AD_SETTINGS,
  mergeAdSettings,
  sanitizeAdminHtml,
  sanitizeLink
} = require('../utils/adConfig');

test('sanitizeAdminHtml removes script tags, inline events, and javascript urls', () => {
  const html = `
    <div onclick="alert(1)">
      <script>alert(1)</script>
      <a href="javascript:alert(1)" onmouseover="alert(2)">test</a>
      <img src="javascript:alert(3)" onload="alert(4)">
    </div>
  `;

  const sanitized = sanitizeAdminHtml(html);

  assert.equal(sanitized.includes('<script>'), false);
  assert.equal(/on(click|mouseover|load)=/i.test(sanitized), false);
  assert.equal(/javascript:/i.test(sanitized), false);
  assert.equal(sanitized.includes('href="#"'), true);
  assert.equal(sanitized.includes('src="#"'), true);
});

test('sanitizeLink only allows http(s) and root-relative links', () => {
  assert.equal(sanitizeLink('https://tanggui.cc/ad'), 'https://tanggui.cc/ad');
  assert.equal(sanitizeLink('http://tanggui.cc/ad'), 'http://tanggui.cc/ad');
  assert.equal(sanitizeLink('/vod/detail/id/1.html'), '/vod/detail/id/1.html');
  assert.equal(sanitizeLink('javascript:alert(1)'), '');
  assert.equal(sanitizeLink('data:text/html,1'), '');
  assert.equal(sanitizeLink('play.html'), '');
});

test('mergeAdSettings keeps defaults and computes banner aspect ratio from dimensions', () => {
  const merged = mergeAdSettings(DEFAULT_AD_SETTINGS, {
    slots: {
      playMetaText: {
        enabled: true,
        html: '<a href="https://tanggui.cc">广告</a>'
      },
      playBetweenBanner: {
        enabled: true,
        image: '/upload/ad/banner.png',
        link: 'https://tanggui.cc',
        alt: '广告图',
        width: '640',
        height: '320',
        openInNewTab: false
      }
    }
  });

  assert.equal(merged.playMetaText.enabled, true);
  assert.equal(merged.playMetaText.html, '<a href="https://tanggui.cc">广告</a>');
  assert.equal(merged.playBetweenBanner.enabled, true);
  assert.equal(merged.playBetweenBanner.image, '/upload/ad/banner.png');
  assert.equal(merged.playBetweenBanner.link, 'https://tanggui.cc');
  assert.equal(merged.playBetweenBanner.width, 640);
  assert.equal(merged.playBetweenBanner.height, 320);
  assert.equal(merged.playBetweenBanner.aspectRatio, '640 / 320');
  assert.equal(merged.playBetweenBanner.openInNewTab, false);
});

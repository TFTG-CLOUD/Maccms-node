const crypto = require('crypto');

function stripHtml(input) {
  return String(input || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePlainText(input) {
  return stripHtml(input);
}

function pagination(total, page, pagesize, url) {
  const totalPages = Math.ceil(total / pagesize) || 1;
  page = Math.max(1, Math.min(page, totalPages));
  const prevUrl = page > 1 ? url.replace('{page}', page - 1) : '';
  const nextUrl = page < totalPages ? url.replace('{page}', page + 1) : '';
  let html = '<div class="mac_pages">';
  html += '<div class="page_tip">共' + total + '条数据,当前' + page + '/' + totalPages + '页</div>';
  if (prevUrl) html += '<a href="' + prevUrl + '">上一页</a>';
  for (let i = 1; i <= totalPages; i++) {
    html += '<a href="' + url.replace('{page}', i) + '" class="' + (i === page ? 'active' : '') + '">' + i + '</a>';
  }
  if (nextUrl) html += '<a href="' + nextUrl + '">下一页</a>';
  html += '</div>';
  return html;
}

function seoReplace(template, obj, site) {
  if (!template) return '';
  const plainContent = sanitizePlainText(obj.content || '');
  return template
    .replace(/\{vod_name\}/g, obj.name || '')
    .replace(/\{vod_actor\}/g, obj.actor || '')
    .replace(/\{vod_director\}/g, obj.director || '')
    .replace(/\{vod_content\}/g, plainContent.substring(0, 200))
    .replace(/\{player_name\}/g, obj.playerName || '')
    .replace(/\{episode_name\}/g, obj.episodeName || '')
    .replace(/\{type_name\}/g, obj.typeName || '')
    .replace(/\{search_word\}/g, obj.searchWord || '')
    .replace(/\{art_name\}/g, obj.name || '')
    .replace(/\{art_content\|mb_substr=0,100\}/g, plainContent.substring(0, 100))
    .replace(/\{siteTitle\}/g, site.siteTitle || '')
    .replace(/\{siteName\}/g, site.siteName || '')
    .replace(/\{siteKeywords\}/g, site.siteKeywords || '')
    .replace(/\{siteDescription\}/g, site.siteDescription || '');
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = { pagination, seoReplace, md5, capitalize, stripHtml, sanitizePlainText };

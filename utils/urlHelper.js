const config = require('../config');

/**
 * 根据 urlMode 配置，为前端页面链接自动添加 /index.php 前缀。
 *
 * - 'clean' 模式：原样返回（/vod/...）
 * - 'pathinfo' 模式：返回 /index.php/vod/...
 *
 * 静态资源路径（/static/, /upload/, /js/, /css/, /images/）和外站绝对 URL 不做处理。
 *
 * @param {string} path - 原始路径，如 '/vod/detail/id/xxx.html'
 * @returns {string} 处理后的路径
 */
function macUrl(path) {
  if (!path || !path.startsWith('/')) return path;
  // 外站绝对 URL 跳过
  if (path.startsWith('//') || /^https?:\/\//i.test(path)) return path;
  // 静态资源跳过
  if (/^\/(?:static|upload|js|css|images|font|icon)\b/.test(path)) return path;

  if (config.urlMode === 'pathinfo') {
    // 如果是 pathinfo 模式，给非 /index.php 开头的路径加上前缀
    if (!path.startsWith('/index.php')) {
      return '/index.php' + path;
    }
  }

  return path;
}

/**
 * 从请求路径中剥离 /index.php 前缀（用于路径比较等场景）。
 * @param {string} reqPath - req.path
 * @returns {string}
 */
function stripIndexPhp(reqPath) {
  return reqPath.replace(/^\/index\.php(?=\/|$)/, '') || '/';
}

module.exports = { macUrl, stripIndexPhp };

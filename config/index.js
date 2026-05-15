module.exports = {
  siteTitle: process.env.SITE_TITLE || '唐诡影视-唐朝诡事录,唐朝诡事录2免费观看,最新电影电视剧免费观看',
  siteName: process.env.SITE_NAME || '唐诡影视',
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  qrTargetUrl: process.env.QR_TARGET_URL || 'https://tanggui.cc',
  siteKeywords: process.env.SITE_KEYWORDS || '唐诡影视站,唐朝诡事录2免费观看,唐朝诡事录免费观看,最新电影电视剧',
  siteDescription: process.env.SITE_DESCRIPTION || '唐诡影视站，提供唐朝诡事录和唐朝诡事录2的免费播放服务，并且附带还提供最新最全的电影电视剧动漫免费在线观看。',
  templateTheme: process.env.TEMPLATE_THEME || 'stui',

  siteWapurl: process.env.SITE_URL || 'http://localhost:3000',
  mobStatus: '0',
  userStatus: 0,
  siteTj: process.env.SITE_TJ || '',
  siteLogo: process.env.SITE_LOGO || '/static/img/logo.png',
  siteWaplogo: process.env.SITE_WAP_LOGO || process.env.SITE_LOGO || '/static/img/logo_min.png',
  siteCopyright: process.env.SITE_COPYRIGHT || 'Copyright © 2008-2026',
  friendLinks: [
    { name: '网站地图', url: 'https://tanggui.cc/rss/index.xml' },
    { name: 'WMDB影视数据库', url: 'https://wmdb.tv' },
    { name: 'vbot影视机器人', url: 'https://vbot.reelbit.cc' },
    { name: 'acg新闻聚合', url: 'https://hacknews.reelbit.cc' }
  ],
  pathTpl: '/static/',

  path: process.env.SITE_URL || 'http://localhost:3000',
  mob: '',

  mid: 1,
  aid: 1,

  cacheType: 'file',
  cacheTime: 3600,
  pageCacheStatus: process.env.CACHE_ENABLE === 'true',
  frontNavCacheTime: Number(process.env.FRONT_NAV_CACHE_TIME || 600),
  frontHomeCacheTime: Number(process.env.FRONT_HOME_CACHE_TIME || 120),

  vod: {
    trysee: 0,
    pwd: '',
    points: { play: 0, down: 0 },
    copyright: 0,
    status: 1,
    lock: 0,
    level: 0
  },

  art: {
    points: { detail: 0 },
    status: 1,
    lock: 0,
    level: 0
  },

  user: {
    status: 1
  },

  comment: {
    status: 1,
    verify: 0
  },

  interface: {
    status: 1,
    pass: '',
    domain: ''
  },

  pathInfoSuffix: '.html',
  pathInfoDepr: '/',

  // URL 模式: 'clean' (无前缀, /vod/...) 或 'pathinfo' (/index.php/vod/...)
  // 生产环境建议通过 URL_MODE 环境变量设置
  urlMode: process.env.URL_MODE || 'clean',

  compress: 0,

  seo: {
    vod: {
      title: '{vod_name} - {siteName}',
      keywords: '{vod_name},{vod_actor},{siteName}',
      description: '{vod_name}在线观看，由{vod_actor}主演，{vod_content}'
    },
    art: {
      title: '{art_name} - {siteName}',
      keywords: '{art_name},{siteName}',
      description: '{art_name} - {art_content|mb_substr=0,100}'
    },
    index: {
      title: '{siteTitle}',
      keywords: '{siteKeywords}',
      description: '{siteDescription}'
    }
  }
};

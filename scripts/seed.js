require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Type = require('../models/Type');

const adminName = process.env.ADMIN_INIT_NAME || 'admin';
const adminPassword = process.env.ADMIN_INIT_PASSWORD || 'admin123';
const adminEmail = process.env.ADMIN_INIT_EMAIL || 'admin@example.com';
const adminNickname = process.env.ADMIN_INIT_NICKNAME || '超级管理员';
const seedArgs = process.argv.slice(2);

// ── 分类种子数据 ──────────────────────────────────────────────
// 数据来源: 当前数据库 types 集合（2026-05-16 导出）
// 父分类 (pid=null)
const PARENT_TYPES = [
  { _id: 20, name: '电影',       en: 'dianying',  pid: null, sort: 0, status: true  },
  { _id: 21, name: '连续剧',     en: 'Tv',        pid: null, sort: 1, status: true  },
  { _id: 22, name: '综艺',       en: 'zongyi',    pid: null, sort: 3, status: true  },
  { _id: 23, name: '动漫',       en: 'dongman',   pid: null, sort: 4, status: true  },
  { _id: 50, name: '体育',       en: 'tiyu',      pid: null, sort: 0, status: false },
  { _id: 61, name: '未分类',     en: 'weifenlei', pid: null, sort: 0, status: false },
];

// pid=20 (电影) 的子分类
const MOVIE_CHILDREN = [
  { _id: 24, name: '动作片',  en: 'dongzuopian' },
  { _id: 25, name: '喜剧片',  en: 'xijupian' },
  { _id: 26, name: '爱情片',  en: 'aiqingpian' },
  { _id: 27, name: '科幻片',  en: 'kehuanpian' },
  { _id: 28, name: '恐怖片',  en: 'kongbupian' },
  { _id: 29, name: '剧情片',  en: 'juqingpian' },
  { _id: 30, name: '战争片',  en: 'zhanzhengpian' },
  { _id: 31, name: '惊悚片',  en: 'jingsongpian' },
  { _id: 32, name: '家庭片',  en: 'jiatingpian' },
  { _id: 33, name: '古装片',  en: 'guzhuangpian' },
  { _id: 34, name: '历史片',  en: 'lishipian' },
  { _id: 35, name: '悬疑片',  en: 'xuanyipian' },
  { _id: 36, name: '犯罪片',  en: 'fanzuipian' },
  { _id: 37, name: '灾难片',  en: 'zhainanpian' },
  { _id: 38, name: '纪录片',  en: 'jilupian' },
  { _id: 39, name: '短片',    en: 'duanpian' },
  { _id: 40, name: '动画电影', en: 'donghuadianying' },
  { _id: 41, name: '西部片',  en: 'xibupian' },
  { _id: 62, name: '冒险片',  en: 'maoxianpian' },
  { _id: 63, name: '奇幻片',  en: 'qihuanpian' },
  { _id: 64, name: '歌舞片',  en: 'gewupian' },
];

// pid=21 (连续剧) 的子分类
const TV_CHILDREN = [
  { _id: 42, name: '台湾剧', en: 'taiwanju' },
  { _id: 43, name: '日本剧', en: 'ribenju' },
  { _id: 44, name: '国产剧', en: 'guochanju' },
  { _id: 45, name: '香港剧', en: 'xianggangju' },
  { _id: 46, name: '韩国剧', en: 'hanguoju' },
  { _id: 47, name: '欧美剧', en: 'oumeiju' },
  { _id: 48, name: '海外剧', en: 'haiwaiju' },
  { _id: 49, name: '泰国剧', en: 'taiguoju' },
  { _id: 66, name: '短剧',   en: 'duanju' },
];

// pid=22 (综艺) 的子分类
const VARIETY_CHILDREN = [
  { _id: 51, name: '大陆综艺', en: 'daluzongyi' },
  { _id: 52, name: '港台综艺', en: 'gangtaizongyi' },
  { _id: 53, name: '日韩综艺', en: 'rihanzongyi' },
  { _id: 54, name: '欧美综艺', en: 'oumeizongyi' },
];

// pid=23 (动漫) 的子分类
const ANIME_CHILDREN = [
  { _id: 58, name: '国产动漫', en: 'guochandongman' },
  { _id: 59, name: '欧美动漫', en: 'oumeidongman' },
  { _id: 60, name: '日韩动漫', en: 'rihandongman' },
];

// pid=50 (体育) 的子分类
const SPORTS_CHILDREN = [
  { _id: 55, name: 'NBA',  en: 'nba',  status: false },
  { _id: 56, name: '足球', en: 'zuqiu', status: false },
  { _id: 57, name: '篮球', en: 'lanqiu', status: false },
];

// ── 扩展配置（父分类的筛选器） ─────────────────────────────
const PARENT_EXTENDS = {
  20: { area: '大陆,中国香港,中国台湾,美国,韩国,日本,泰国,新加坡,马来西亚,印度,英国,法国,加拿大,西班牙,俄罗斯,意大利',
        year: '2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016,2015,2014,2013,2012,2011,2010,2009,2008,2007,2006,2005,2004,2003,2002,2001,2000',
        class: '', lang: '' },
  21: { area: '大陆,中国香港,中国台湾,美国,韩国,日本,泰国,新加坡,马来西亚,印度,英国,法国,加拿大,西班牙,俄罗斯,意大利',
        year: '2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016,2015,2014,2013,2012,2011,2010,2009,2008,2007,2006,2005,2004,2003,2002,2001,2000',
        class: '', lang: '' },
  22: { area: '大陆,中国台湾,中国香港,日本,韩国,美国,俄罗斯',
        year: '2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016,2015,2014,2013,2012,2011,2010,2009,2008,2007,2006,2005,2004,2003,2002,2001,2000',
        class: '', lang: '' },
  23: { area: '大陆,日本,美国',
        year: '2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016,2015,2014,2013,2012,2011,2010,2009,2008,2007,2006,2005,2004,2003,2002,2001,2000',
        class: '', lang: '' },
};

// ── 辅助函数 ──────────────────────────────────────────────
function buildChild(opt, pid) {
  const extend = { class: '', area: '', lang: '', year: '', star: '', director: '', state: '', version: '' };
  return { _id: opt._id, name: opt.name, en: opt.en, pid, mid: 1, sort: 0, status: opt.status !== undefined ? opt.status : true, extend, tpl: 'type.html', tplDetail: 'detail.html', tplPlay: '', logo: '', tplDown: '' };
}

function buildParent(p) {
  const defaults = { class: '', area: '', lang: '', year: '', star: '', director: '', state: '', version: '' };
  return { ...p, mid: 1, extend: PARENT_EXTENDS[p._id] || defaults, tpl: 'type.html', tplDetail: 'detail.html', tplPlay: '', logo: '', tplDown: '' };
}

function getAllTypes() {
  const parents = PARENT_TYPES.map(buildParent);
  const children = [
    ...MOVIE_CHILDREN.map((c) => buildChild(c, 20)),
    ...TV_CHILDREN.map((c) => buildChild(c, 21)),
    ...VARIETY_CHILDREN.map((c) => buildChild(c, 22)),
    ...ANIME_CHILDREN.map((c) => buildChild(c, 23)),
    ...SPORTS_CHILDREN.map((c) => buildChild(c, 50)),
  ];
  return [...parents, ...children];
}

function shouldSeedTypes(args = []) {
  return args.includes('--with-types');
}

async function seedAdminAccount() {
  const existing = await Admin.findOne({ name: adminName });
  if (!existing) {
    await Admin.create({
      name: adminName,
      password: bcrypt.hashSync(adminPassword, 10),
      email: adminEmail,
      nickname: adminNickname,
      groupId: 1,
      status: 1
    });
    console.log(`Admin account created: ${adminName}`);
    return;
  }
  console.log(`Admin account already exists: ${adminName}`);
}

async function seedTypes() {
  const allTypes = getAllTypes();
  let inserted = 0;
  for (const type of allTypes) {
    const exists = await Type.findById(type._id);
    if (!exists) {
      await Type.create(type);
      inserted++;
    }
  }

  if (inserted > 0) {
    console.log(`Types seeded: ${inserted} new, ${allTypes.length - inserted} already exist`);
    return;
  }
  console.log(`All ${allTypes.length} types already exist`);
}

async function main(args = seedArgs) {
  const seedTypeData = shouldSeedTypes(args);
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    await seedAdminAccount();

    if (seedTypeData) {
      await seedTypes();
    } else {
      console.log('Skip type seed. Pass --with-types to initialize built-in categories.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  getAllTypes,
  seedAdminAccount,
  seedTypes,
  shouldSeedTypes
};

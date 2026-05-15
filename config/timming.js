module.exports = [
  {
    "status": 1,
    "name": "collect_1day",
    "des": "采集1天内更新",
    "file": "collect",
    "param": {
      "type": "1day"
    },
    "weeks": "0,1,2,3,4,5,6",
    "hours": "06,12,18,23",
    "runtime": 1778857200671
  },
  {
    "status": 1,
    "name": "collect_2day",
    "des": "采集2天内更新",
    "file": "collect",
    "param": {
      "type": "2day"
    },
    "weeks": "0,1,2,3,4,5,6",
    "hours": "02,14",
    "runtime": null
  },
  {
    "status": 1,
    "name": "collect_week",
    "des": "采集本周更新",
    "file": "collect",
    "param": {
      "type": "week"
    },
    "weeks": "0,2,4,6",
    "hours": "03",
    "runtime": null
  },
  {
    "status": 1,
    "name": "collect_month",
    "des": "采集30天内更新",
    "file": "collect",
    "param": {
      "type": "month"
    },
    "weeks": "0",
    "hours": "02",
    "runtime": null
  },
  {
    "status": 0,
    "name": "collect_all",
    "des": "全量采集(首次使用)",
    "file": "collect",
    "param": {
      "type": "all"
    },
    "weeks": "",
    "hours": "",
    "runtime": null
  },
  {
    "status": 1,
    "name": "cache_clear",
    "des": "清理过期缓存",
    "file": "cache",
    "param": {},
    "weeks": "0,1,2,3,4,5,6",
    "hours": "04",
    "runtime": null
  },
  {
    "status": 1,
    "name": "hits_day_reset",
    "des": "重置日点击统计",
    "file": "hits",
    "param": {
      "scope": "day"
    },
    "weeks": "0,1,2,3,4,5,6",
    "hours": "00",
    "runtime": null
  },
  {
    "status": 1,
    "name": "hits_week_reset",
    "des": "重置周点击统计",
    "file": "hits",
    "param": {
      "scope": "week"
    },
    "weeks": "1",
    "hours": "00",
    "runtime": null
  },
  {
    "status": 1,
    "name": "hits_month_reset",
    "des": "重置月点击统计",
    "file": "hits",
    "param": {
      "scope": "month"
    },
    "weeks": "",
    "monthdays": "1",
    "hours": "00",
    "runtime": null
  }
];

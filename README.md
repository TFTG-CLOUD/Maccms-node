# maccms-node

基于 Node.js + Express + MongoDB + Pug 的 MACCMS 风格影视站实现，核心应用位于 `node-back/`。

这个项目的重点不是“重新做一个 CMS”，而是尽量让现有 MACCMS 站点可以低成本迁移过来:

- 数据尽量无缝迁移
- 路由尽量保持和 MACCMS 一致
- 模板尽量复用，支持从 MACCMS 模板批量迁移到 Pug
- 采集、分类、详情、播放、后台管理等常用能力继续可用

如果你已经有一个在跑的 MACCMS 站，这个项目最适合的使用方式就是: 迁移旧数据、迁移旧模板、保留原有访问路径习惯，然后逐步把前后端维护切到 Node 版本。

## 核心特性

- 无缝迁移 MACCMS 数据
  - 支持从旧站 SQL dump 导入分类、视频、采集源、采集绑定、SEO 配置
  - 分类和视频 `_id` 可直接沿用 MACCMS 数字 ID，避免数字 ID / ObjectId 混用
- 路由兼容 MACCMS
  - 支持 `clean` 模式: `/vod/detail/id/123.html`
  - 支持 `pathinfo` 模式: `/index.php/vod/detail/id/123.html`
  - `clean` 模式下旧的 `/index.php/...` 链接会自动 301 到无前缀新地址
- 模板迁移友好
  - 内置模板迁移脚本，可把 MACCMS/stui 模板批量转换为 Pug
  - 支持变量、循环、部分条件和常见路由辅助函数转换
  - 对复杂 PHP 块和复杂标签会保留人工修复提示
- 前台能力完整
  - 首页、分类页、详情页、播放页、搜索页、专题页
  - 聚合筛选、分页、猜你喜欢、热门榜单
  - 播放页原生 `video` 播放 m3u8，必要时使用 HLS.js 兜底
- 后台能力可用
  - 视频管理、分类管理、采集源管理、采集绑定、SEO 设置、广告位管理、定时任务
- 采集能力面向 `vod`
  - 仅聚焦视频采集，不包含文章等其它模型采集
  - 支持手动采集今天、1 天内、2 天内、本周、本月、最近 3 月、全量
  - 支持后台任务队列、进度展示、重启后恢复卡死任务状态
  - 图片支持批量并发下载，失败自动重试，仍失败则回退默认海报
- 基础性能优化
  - 支持页面缓存开关
  - 首页导航和首页区块带内存缓存
  - 静态资源开启压缩和缓存头
- 榜单统计
  - 支持总人气、日榜、周榜、月榜
  - 日/周/月榜支持通过定时任务做真实滚动重置

## 目录说明

```text
maccms-node/
├── README.md
├── maccms10-master/              # 可选: 保留旧版 MACCMS 代码做对照
└── node-back/                    # Node 版本主应用
    ├── app.js
    ├── config/
    ├── controllers/
    ├── models/
    ├── old/                      # 放旧站配置文件
    │   ├── bind.php
    │   └── maccms.php
    ├── public/
    ├── routes/
    ├── scripts/
    │   ├── migrate.js
    │   └── seed.js
    ├── services/
    ├── tools/
    │   └── template-converter.js
    ├── views/
    └── package.json
```

## 适用场景

这个项目尤其适合以下场景:

- 你已经有 MACCMS 站点，希望迁到 Node 生态继续维护
- 你不想重做全部 URL，希望前台路径尽量保持不变
- 你已经有现成模板，尤其是 `stui` 体系模板，希望迁移后继续使用
- 你希望继续沿用旧采集源和分类绑定逻辑
- 你想逐步迁移，而不是一次性推翻旧站

## 环境要求

建议环境:

- Node.js 18 或更高版本
- MongoDB 6 或更高版本
- npm 9 或更高版本

## 安装

进入 Node 应用目录:

```bash
cd node-back
```

安装依赖:

```bash
npm install
```

创建 `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/maccms_node
SESSION_SECRET=replace-with-a-long-random-string
ADMIN_SESSION_MAX_AGE_MS=2592000000
TRUST_PROXY=1

SITE_TITLE=唐诡影视
SITE_NAME=唐诡影视
SITE_URL=http://localhost:3000
SITE_KEYWORDS=最新电影,最新电视剧,影视站
SITE_DESCRIPTION=基于 Node.js 的 MACCMS 风格影视站
SITE_LOGO=/static/img/logo.png
SITE_WAP_LOGO=/static/img/logo_min.png
SITE_COPYRIGHT=Copyright © 2008-2026
SITE_TJ=
QR_TARGET_URL=https://tanggui.cc

TEMPLATE_THEME=stui
URL_MODE=clean

CACHE_ENABLE=true
FRONT_NAV_CACHE_TIME=600
FRONT_HOME_CACHE_TIME=120

ENABLE_CRON=true

ADMIN_INIT_NAME=admin
ADMIN_INIT_PASSWORD=admin123
ADMIN_INIT_EMAIL=admin@example.com
ADMIN_INIT_NICKNAME=超级管理员
```

初始化管理员账号:

```bash
node scripts/seed.js
```

初始化管理员账号并补充内置分类:

```bash
node scripts/seed.js --with-types
```

开发模式启动:

```bash
npm run dev
```

生产模式启动:

```bash
npm start
```

默认后台登录地址:

```text
http://localhost:3000/admin/login
```

## 常用环境变量

| 变量 | 说明 |
| --- | --- |
| `MONGODB_URI` | MongoDB 连接字符串 |
| `REDIS_URL` | Redis 连接字符串；配置后搜索限流会改为多进程共享 |
| `PORT` | 服务端口 |
| `SESSION_SECRET` | Session 密钥 |
| `ADMIN_SESSION_MAX_AGE_MS` | 后台登录态有效期，单位毫秒，默认 30 天 |
| `TRUST_PROXY` | 反向代理层数或规则；走 Caddy/Nginx 时建议设置为 `1` |
| `CRON_PRIMARY_ONLY` | `true` 时仅 PM2 主实例运行 cron，默认 `true` |
| `SEARCH_RATE_LIMIT_WINDOW_MS` | 前台搜索单网段限流窗口，默认 `60000` 毫秒 |
| `SEARCH_RATE_LIMIT_MAX` | 前台搜索单网段在短窗口内允许次数，默认 `6` |
| `SEARCH_RATE_LIMIT_BAN_WINDOW_MS` | 前台搜索封禁统计窗口，默认 `3600000` 毫秒 |
| `SEARCH_RATE_LIMIT_BAN_MAX` | 前台搜索单网段在封禁统计窗口内允许次数，默认 `100` |
| `SEARCH_RATE_LIMIT_BAN_DURATION_MS` | 前台搜索触发封禁后的限制时长，默认 `21600000` 毫秒 |
| `TEMPLATE_THEME` | 当前主题，默认 `stui` |
| `URL_MODE` | 路由模式，`clean` 或 `pathinfo` |
| `CACHE_ENABLE` | 是否启用页面缓存，`true` 时开启 |
| `PAGE_CACHE_TTL_MS` | 页面缓存 TTL，默认 `3600000` 毫秒 |
| `PAGE_CACHE_MAX_ENTRIES` | 页面缓存最大条目数，默认 `500` |
| `RUNTIME_CACHE_MAX_ENTRIES` | 运行时缓存最大条目数，默认 `300` |
| `CACHE_CLEANUP_INTERVAL_MS` | 缓存清理周期，默认 `60000` 毫秒 |
| `FRONT_NAV_CACHE_TIME` | 前台导航缓存秒数 |
| `FRONT_HOME_CACHE_TIME` | 首页区块缓存秒数 |
| `ENABLE_CRON` | 是否启用定时任务轮询 |
| `QR_TARGET_URL` | 二维码目标地址 |
| `ADMIN_INIT_*` | 初始化管理员账号信息 |

## Caddy 反向代理示例

如果你用 Caddy 反向代理 `node-back`，推荐把 `.env` 里的下面这个配置打开:

```env
TRUST_PROXY=1
```

这表示应用信任一层反向代理，适合常见的单层 Caddy -> Node 部署。这样登录限流、搜索限流和后台 session 才能正确识别真实客户端 IP。

一个基础的 `Caddyfile` 示例:

```caddy
example.com {
    encode gzip zstd

    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}
```

如果你同时提供 `www` 和主域名，也可以这样写:

```caddy
example.com, www.example.com {
    encode gzip zstd

    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}
```

说明:

- Node 应用默认监听 `3000`，如果你改了 `PORT`，这里也要对应修改
- 如果你的链路不止一层代理，需要按实际代理层数调整 `TRUST_PROXY`
- 如果你只是在本机直接访问 `localhost:3000`，不需要 Caddy，也可以把 `TRUST_PROXY` 留空或设为 `false`

## 路由兼容模式

项目支持两套路由模式，方便对接旧站历史链接。

### 1. `clean` 模式

配置:

```env
URL_MODE=clean
```

前台链接示例:

```text
/vod/detail/id/123.html
/vod/play/id/123/sid/1/nid/1.html
/vod/show/id/39/area/大陆/year/2025/letter/A.html
/vod/search.html?wd=美丽
```

特点:

- 前台所有链接默认输出为无 `index.php` 前缀
- 如果用户访问 `/index.php/...`，系统会自动 301 重定向到对应的无前缀路径
- 比较适合新的 Node 部署环境

### 2. `pathinfo` 模式

配置:

```env
URL_MODE=pathinfo
```

前台链接示例:

```text
/index.php/vod/detail/id/123.html
/index.php/vod/play/id/123/sid/1/nid/1.html
/index.php/vod/show/id/39/by/hits.html
```

特点:

- 更接近传统 MACCMS 的 `index.php` 访问方式
- 适合你希望前端链接与旧站尽量保持一致时使用
- 前端模板通过 `macUrl()` 统一处理路径前缀

## 从 MACCMS 迁移

这是这个项目最重要的使用场景。

### 一、准备旧站配置文件

把旧站里的下面两个文件复制到:

```text
node-back/old/bind.php
node-back/old/maccms.php
```

这一步非常关键。

- `bind.php` 用于恢复采集源和本地分类之间的绑定关系
- `maccms.php` 用于迁移旧站 SEO 等配置

如果这两个文件不放到 `node-back/old/`，迁移脚本无法完整恢复旧站的分类绑定和部分配置。

### 二、导出旧站数据库 SQL

当前迁移脚本不是直接连旧 MySQL，而是读取 SQL dump 文件。

也就是说，你需要先从旧 MACCMS 导出数据库 SQL 文件，例如:

```bash
mysqldump -u root -p old_maccms_db > /tmp/maccms.sql
```

### 三、修改迁移脚本中的 SQL 文件路径

当前版本的迁移脚本默认在 `node-back/scripts/migrate.js` 中读取固定 SQL 路径。

请打开:

```text
node-back/scripts/migrate.js
```

把顶部的 `SQL_FILE` 常量改成你的 SQL dump 实际路径，例如:

```js
const SQL_FILE = '/tmp/maccms.sql';
```

### 四、执行迁移

在 `node-back/` 目录执行:

```bash
node scripts/migrate.js
```

当前迁移脚本会导入以下内容:

- `mac_type` -> 本地分类
- `mac_vod` -> 本地视频
- `mac_collect` -> 采集源
- `bind.php` -> 采集分类绑定
- `maccms.php` -> SEO 配置

迁移完成后，分类和视频会尽量沿用 MACCMS 原来的数字 ID，这一点很重要:

- 可以避免 ObjectId 和数字 ID 混用带来的查询问题
- 更利于保留旧模板中的 ID 逻辑
- 更利于前端链接继续沿用旧站风格

### 五、迁移图片与附件

如果旧站图片原本是本地存储，建议把旧站上传目录同步到 Node 项目中对应位置，例如:

```text
node-back/public/upload/
```

说明:

- 旧数据中的图片如果本来就是远程 URL，可以直接继续使用
- 如果旧数据图片链接失效，采集系统后续下载失败会回退到默认海报 `/img/no-poster.webp`
- 如果你计划之后再补齐图片目录，也可以先让站点跑起来

### 六、初始化管理员并启动

```bash
node scripts/seed.js
npm start
```

如果你需要在空库中一并写入内置分类:

```bash
node scripts/seed.js --with-types
npm start
```

### 七、迁移后建议检查

- 首页导航和一级分类是否正常
- 分类页筛选条件是否和旧站一致
- 详情页和播放页链接是否符合预期
- 搜索页 `/vod/search.html?wd=关键词` 是否正常
- 采集源和分类绑定是否完整恢复
- 图片路径是否仍然有效

## 模板迁移

项目自带模板迁移脚本，目标是帮助你把旧 MACCMS 模板更快迁到 Node 版本。

脚本位置:

```text
node-back/tools/template-converter.js
```

### 基本用法

把旧模板目录转换到一个新目录:

```bash
node tools/template-converter.js /path/to/stui_tpl/html /Users/quyue/www/maccms-node/node-back/views/stui_auto
```

也可以只转换单个文件:

```bash
node tools/template-converter.js /path/to/index.html /Users/quyue/www/maccms-node/node-back/views/stui/index.pug
```

### 转换能力

已支持的常见内容:

- 常见变量替换
- 常见 `volist` 循环转换
- 部分 `if/elseif/else` 结构转换
- 常见 `mac_url_*` 路由辅助转换
- 常见 `include` 转换
- HTML 到 Pug 结构转换

### 仍需人工处理的场景

模板迁移脚本不是 100% 自动化，以下情况通常仍需人工收尾:

- 复杂的 `{maccms:...}` 查询块
- 模板里的原生 PHP 逻辑
- 很复杂的 URL helper
- 特殊条件渲染和内联逻辑

脚本在生成的 Pug 文件顶部会写出手工修复提示，建议按提示逐个处理。（再交给AI可以极短时间完成模板迁移）

### 为什么说它适合 MACCMS 模板迁移

因为这套 Node 前端本身就尽量遵循了 MACCMS 的页面结构和路由风格:

- URL 风格兼容
- 主题目录结构接近
- 详情、播放、列表、搜索等页面模型接近
- `stui` 模板迁移成本更低

这意味着你不需要完全重写前端，很多旧模板可以在迁移和修整后继续使用。

## 采集功能说明

当前采集只聚焦 `vod`，不支持文章等其它模型采集。

### 已支持能力

- 手动采集
  - 今天 `today`
  - 1 天内 `1day`
  - 2 天内 `2day`
  - 本周 `week`
  - 本月 `month`
  - 最近 3 月 `3month`
  - 全量 `all`
- 后台任务队列
  - 采集任务在后台自动跑
  - 后台可查看任务进度和状态
- 防卡死恢复
  - 应用重启时会自动恢复陈旧任务状态，避免一直显示“采集中”
- 图片下载优化
  - 批量并发下载
  - 默认重试 2 次
  - 最终失败则回退默认海报
- 播放地址入库优化
  - 可对播放源和剧集做合并更新
  - 尽量避免简单覆盖已有可用播放数据

### 定时任务

定时任务入口在后台:

```text
/admin/timming
```

当前定时任务由服务启动后每 30 分钟轮询一次。

已包含:

- 采集任务定时执行
- 日榜 / 周榜 / 月榜命中重置任务

## 广告位管理

后台已支持两个播放页广告位:

- 播放页信息区下方的文本广告位
  - 支持多行 HTML
  - 文案与链接直接写在 HTML 中
- 播放区与播放地址之间的图片广告位
  - 支持上传图片
  - 支持设置跳转链接
  - 会保存图片宽高用于前台预留比例，减少页面抖动

后台入口:

```text
/admin/ad
```

## 缓存与性能

### `CACHE_ENABLE=true` 有什么作用

当设置为 `true` 时，会启用页面缓存中间件。

当前页面缓存只缓存白名单页面:

- 首页
- 分类页
- 筛选页
- 详情页

搜索页和任何带 query string 的 URL 不会进入页面缓存。

配置 `REDIS_URL` 后，页面缓存和运行时缓存都会切换到 Redis 共享存储。
如果没有配置 Redis，则会回退到 Node 进程内存缓存。

它的意义主要是:

- 减少重复模板渲染
- 减少热点页面的数据库查询压力
- 对热门列表页、首页、详情页更友好

另外，系统还内置了两类轻量缓存:

- 导航缓存 `FRONT_NAV_CACHE_TIME`
- 首页区块缓存 `FRONT_HOME_CACHE_TIME`

如果你的站点访问量不大，可以先不开；如果首页、分类页、详情页访问频繁，建议开启。

如果你使用 PM2 多进程:

- 配置了 `REDIS_URL` 时，页面缓存和运行时缓存会在 worker 之间共享
- 没配置 `REDIS_URL` 时，页面缓存和运行时缓存仍然是每个 worker 各自一份
- 搜索限流在配置 `REDIS_URL` 后会切换为 Redis 共享计数
- `CRON_PRIMARY_ONLY=true` 时，只有 `NODE_APP_INSTANCE=0` 的进程会启动定时任务

## 命中统计说明

视频模型中常见字段包括:

- `hits`
- `hitsDay`
- `hitsWeek`
- `hitsMonth`

含义:

- `hits` 是总访问量
- `hitsDay` 是日榜统计
- `hitsWeek` 是周榜统计
- `hitsMonth` 是月榜统计

项目已支持通过定时任务按日、周、月做滚动重置，这样周榜和月榜不再只是静态累计值。

## 开发与测试

开发模式:

```bash
npm run dev
```

测试:

```bash
npm test
```

当前测试脚本会执行 `node-back/tests/*.test.js`。

## 常见问题

### 1. 我想尽量保持和 MACCMS 一样的链接，怎么配

使用:

```env
URL_MODE=pathinfo
```

这样前端生成的地址会带 `/index.php` 前缀，更接近旧站。

### 2. 我想用更干净的新链接，但历史 `/index.php/...` 链接又不想完全失效

使用:

```env
URL_MODE=clean
```

系统会把 `/index.php/...` 自动 301 到对应的新路径。

### 3. 模板是不是可以完全自动迁移

不能保证 100% 自动。

但它已经能帮你处理大量重复劳动，尤其是:

- `stui` 风格模板
- 常见变量输出
- 常见循环与 include
- 常见 URL helper

复杂逻辑仍需要人工收尾，不过整体迁移成本会明显低于手工重写。

### 4. 旧站图片不显示怎么办

优先检查:

- 是否已经把旧站上传目录同步到 `node-back/public/upload/`
- 旧数据里的图片路径是相对路径还是远程 URL
- 远程图是否还能访问

### 5. 迁移脚本为什么还要我改 SQL 文件路径

因为当前版本的 `scripts/migrate.js` 是按 SQL dump 文件导入设计的，顶部 `SQL_FILE` 是固定常量。

如果你想进一步提升易用性，后续可以把它改造成支持命令行参数或环境变量传入 SQL 路径。

## 推荐迁移流程

如果你准备从现有 MACCMS 站正式切过来，建议按下面顺序操作:

1. 保留旧站完整代码和数据库备份
2. 把 `bind.php` 和 `maccms.php` 放进 `node-back/old/`
3. 导出旧站 SQL dump
4. 修改 `node-back/scripts/migrate.js` 中的 `SQL_FILE`
5. 执行数据迁移
6. 同步旧站上传图片目录到 `node-back/public/upload/`
7. 如果有旧模板，先用 `template-converter.js` 批量转换
8. 根据你的站点选择 `URL_MODE=clean` 或 `URL_MODE=pathinfo`
9. 初始化后台管理员
10. 启动服务并逐页核对前台和后台

## 总结

这个项目最值得推荐的地方，不是单纯“用 Node 重写了 MACCMS”，而是它明确围绕迁移场景来设计:

- 老数据可以迁
- 老模板可以迁
- 老路由可以继续兼容
- 老采集思路可以继续沿用

如果你的目标是尽量平滑地从 MACCMS 迁到 Node，而不是推倒重来，这套方案会比从零重新搭一个影视站实用得多。

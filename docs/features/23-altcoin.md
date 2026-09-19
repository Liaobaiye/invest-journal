# 山寨币监测 Altcoin Volume Spike

- **ID**: `altcoin`
- **路由**: `#/altcoin`
- **状态**: 内存缓存（服务端）+ `localStorage.myweb_altcoin_params`（参数）+ `db.settings.altcoin_config`（自动扫描开关）+ `server/src/data/altcoin_reports/`（HTML 历史）
- **依赖**: `api`；`mailer`；代理；登录后才能启动扫描 / 改自动开关

## 用户可见行为

1. 工具条：倍数阈值 / 检测近 N 天 / 对比前 N 天均量 / 最多扫描对数（0=全量）+「开始扫描」
2. **开关**「每 4 小时自动扫描并邮件」：服务端定时扫描；有异动时发 SMTP 汇总邮件，并生成 HTML 报告
3. 扫描进度条（轮询 `/api/altcoin/status`）
4. 统计卡：异动数量、最高/平均倍数、耗时
5. 左侧表格：排名、币种、异动日、倍数、现量、前均量；点击选中
6. 右侧 canvas K 线（约 60 日）+ 成交量副图，异动日橙色虚线与倍数标注
7. **历史报告**列表（页面底部）：每次扫描完成后生成独立 HTML；点击在新标签打开

## 筛选逻辑（与 notebook 对齐）

- 数据源：Binance **现货**日线 `api.binance.com`
- 量 > `threshold` × 前 `previousDays` 日均量
- 形态：实体长度 ≤ 上影线（长上影 / 射击之星类）
- 同一币只取**首个**命中日；结果按倍数降序

## 自动扫描与邮件

- 开关存 `db.settings.altcoin_config.autoScanEmail`（默认 **关**）
- 间隔固定 **4 小时**（`intervalHours`）；服务端每 60s 检查一次是否到期
- 开启时若 `lastAutoRunAt` 为空，从开启时刻起计时
- **自动扫描一启动**就写入 `lastAutoRunAt`（失败也等下一周期，避免每分钟重试）
- 自动扫描参数：优先 `altcoin_config.lastScanParams`（每次扫描会持久化），否则默认 5× / 10天 / 前7天 / 全量
- 自动扫描完成后：`coins.length > 0` 且已配置 `EMAIL_*` → 发一封汇总邮件
- 手动扫描：若开关开（或 body `emailNotify=true`）同样在有异动时发邮件
- 邮件失败 / 报告失败只写入 `results.lastNotify` / `lastReport.error`，**不中断扫描**
- 扫描结果先写入 cache 再做报告/邮件：`status.postProcessing=true` 期间前端继续轮询

## 历史 HTML 报告

- 目录：`server/src/data/altcoin_reports/`，索引 `index.json`（最多 50 条，自动删旧）
- 每份报告为**独立可打开**的 HTML：内嵌 Top N（默认 30）币种 OHLCV + canvas K 线
- 访问：`GET /api/altcoin/history/:file`
- 邮件/列表中的链接为**完整网址**：`${PUBLIC_BASE_URL}/api/altcoin/history/<file>`
  - `PUBLIC_BASE_URL` 在 `server/.env` 配置；未配置时默认 `http://localhost:PORT`

## 文件清单

| 文件 | 职责 |
|------|------|
| `js/pages/altcoin.js` | 页面 + 开关 + 历史列表 + canvas K 线 |
| `css/pages/altcoin.css` | `.altcoin-page` / `.ac-*` |
| `js/api.js` | `altcoinStatus/Results/startAltcoinScan/altcoinKlines/altcoinSettings/saveAltcoinSettings/altcoinHistory` |
| `js/app.js` | `route('/altcoin')` |
| `js/components/header.js` | 导航「山寨币」 |
| `server/src/services/altcoinService.js` | 扫描 / 状态 / 调度 / 扫后报告+邮件 |
| `server/src/services/altcoinReport.js` | 历史 HTML 生成与索引 |
| `server/src/services/emailTemplates.js` | `renderAltcoinSpikeEmailHtml/Text` |
| `server/src/services/mailer.js` | `sendAltcoinSpikeEmail` |
| `server/src/services/repository.js` | `get/saveAltcoinConfig` |
| `server/src/app.js` | `/api/altcoin/*` |
| `server/src/index.js` | 启动 `startAltcoinScheduler()` |

## API

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/altcoin/status` | 否 | 扫描进度 + 自动开关/下次时间 |
| GET | `/api/altcoin/results` | 否 | 上次结果缓存 + `lastReport`/`lastNotify` |
| GET | `/api/altcoin/settings` | 否 | 自动扫描设置 + `emailConfigured` |
| PUT | `/api/altcoin/settings` | 是 | `{ autoScanEmail, intervalHours?, reportTopN? }` |
| GET | `/api/altcoin/history` | 否 | 历史报告列表 |
| GET | `/api/altcoin/history/:id` | 否 | 打开某份 HTML 报告 |
| POST | `/api/altcoin/scan` | 是 | 启动扫描（threshold, daysToCheck, previousDays, maxSymbols, concurrency, emailNotify?） |
| GET | `/api/altcoin/klines?symbol&limit` | 否 | 日线 OHLCV，供前端画图 |

扫描在服务端后台跑（并发默认 6），重复 POST 在运行中返回 409。

## 数据流

```text
手动点扫描 或 调度器到期
  → POST/自动 startScan
  → mapLimit 拉 klines → detectSpike
  → 写 cache
  → buildAltcoinReport（Top N 拉 K 线 → 独立 HTML + index.json）
  → 若需邮件且有异动 → sendAltcoinSpikeEmail
前端轮询 status → GET results + history → 表格 / 历史列表
```

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 去掉形态过滤 | `altcoinService.js` `detectSpike` 去掉 `body <= upper` |
| 用 U 计价量 | `detectSpike` 改比 `quoteVolume` |
| 改默认并发 | `DEFAULTS.concurrency` |
| 改自动间隔 | `repository.js` `intervalHours` + service 调度判断（当前默认 4h） |
| 改报告 Top N | settings `reportTopN`（5–50） |
| 改邮件版式 | `emailTemplates.js` `renderAltcoinSpikeEmailHtml` |
| 改报告页样式 | `altcoinReport.js` `renderReportHtml` |

## 隔离边界

- 仅本页 + 专属 `/api/altcoin/*`；失败不影响提醒/组合
- 扫描结果仅内存，重启丢失；不写 db.json（**开关与 lastAutoRunAt 写 settings**）
- 历史 HTML 落盘 `server/src/data/altcoin_reports/`（已被 data 目录惯例覆盖）
- 邮件/报告失败不抛到未捕获；扫描结果仍可用
- 扫描较重（全量约 487 对），需登录；运行中再次扫描返回 409
- 自动扫描依赖**服务端进程存活**；前端关页不影响调度

## 变更记录

- 2026-09: 由 notebook 迁入为独立页「山寨币监测」
- 2026-09: 修复进度条结束后仍显示（CSS `display:flex` 压过 `hidden`）
- 2026-09: 增加「每 4 小时自动扫描并邮件」开关、美观 SMTP 汇总邮件、扫描后独立 HTML 历史报告与列表
- 2026-09: 修复：自动扫描失败时每分钟重试；`running` 被报告/邮件拖住；自动扫描沿用内存临时参数；`.env` 去掉明文授权码；`server/src/data/` 加入 gitignore；报告路径校验收紧
- 2026-09: 邮件/历史列表中的报告链接改为完整网址（`PUBLIC_BASE_URL`，默认 `http://localhost:PORT`）

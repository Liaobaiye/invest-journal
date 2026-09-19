# 交易提醒 Alerts

- **ID**: `alerts`
- **路由**: `#/alerts`
- **状态**: `localStorage.myweb_alerts` + 服务端 settings（stablecoin/drawdown/news/volatility monitor）
- **依赖**: `api`；登录后同步/启动监测；行情/新闻/SMTP 见各子功能

## 用户可见行为

四张配置卡 + 右侧告警历史：

### 1. 波动监控 `#card-vol`
- 开关 → 服务端 K 线振幅监测（见 [18-server-alerts](18-server-alerts.md)）
- 周期/阈值/交易所/币种；波动发邮件；同步并启动；立即检测

### 2. 回撤监控 `#card-dd` — **仓位收益回撤**
- 口径：**浮盈峰值 → 当前浮盈**（例：峰值 1000U → 现在 700U = 30% 回撤）
- **必须配置交易所 API Key**（设置页）：OKX 需 Key/Secret/**Passphrase**；Binance 合约 Key/Secret；权限**只读**
- 服务端周期调用私有接口拉持仓 `upl`，按仓位记峰值并计算回撤
- 默认盯「回撤最深的仓位」；配置 `mode=total` 可改为盯全部持仓总浮盈
- 无 Key / 拉仓失败：历史不写，UI 提示去设置
- 开关 + 阈值（默认 30%）+ 回撤发邮件 + 同步并启动 + 立即检测

### 3. 消息面 AI `#card-news`
- 风险阈值 + 分类：宏观/监管/交易所 + 消息发邮件
- 服务端拉 OKX 公告 / Cointelegraph RSS / Binance 公告（多源回退）
- **规则关键词评分** 0–100；若配置 `AI_API_BASE_URL`+`AI_API_KEY` 可叠加 AI 评分
- 「同步并启动」「立即检测」

### 4. 稳定币脱锚 `#card-sc`（[21-stablecoin](21-stablecoin.md)）
- 币种/阈值/脱钩发邮件
- **自动扫描**勾选后保存：服务端按间隔（默认 300s）检测，命中写历史并可发邮件
- 手动「检测」仍可用

### 历史侧栏
- 类型：波动 / 回撤 / 消息 / 稳定币

## 文件清单

- `js/pages/alerts.js`
- `css/pages/alerts.css`
- `server/src/services/alertsMonitor.js` — 稳定币自动扫 / 回撤 / 消息面
- `server/src/services/volatilityMonitor.js` — 波动
- `server/src/services/stablecoinService.js` — Coinbase 价格

## API（提醒运行时）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/alerts/runtime` | 三块监测运行状态 |
| POST | `/api/alerts/runtime/sync` | 按当前配置启停 |
| GET/PUT | `/api/alerts/drawdown/config` | 回撤配置 |
| POST | `/api/alerts/drawdown/check` | 立即回撤检测 |
| GET/PUT | `/api/alerts/news/config` | 消息面配置 |
| POST | `/api/alerts/news/check` | 立即新闻检测 |
| POST | `/api/alerts/stablecoin/check-auto` | 立即稳定币检测（写历史） |
| PUT | `/api/stablecoins/config` | 含 `autoScan`/`intervalSec`，保存后自动 sync |

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 回撤数据源 | `exchangePrivate.js` + `alertsMonitor.checkDrawdownOnce` |
| 新闻源/关键词 | `alertsMonitor.js` `NEWS_SOURCES` / `RULES` |
| 稳定币自动间隔 | 保存配置 `intervalSec`（60–3600，默认 300） |
| AI 评分 | `.env` `AI_API_BASE_URL` `AI_API_KEY` `AI_MODEL` |

## 隔离边界

- 单监测失败只写 `lastError`，不影响其他卡
- 邮件失败不阻断写 `alert_log`
- 未登录只改 localStorage，不启服务端循环

## 变更记录

- 2026-09: 初版三卡 + 本地持久化；稳定币卡；chip 修复
- 2026-09: 波动接真实服务端监测
- 2026-09: 稳定币自动扫描、回撤（权益版）、消息面落地
- 2026-09: **回撤改为仓位收益回撤**（API Key 拉持仓 upl，峰值→当前）；`exchangePrivate.js` OKX/Binance 私有接口

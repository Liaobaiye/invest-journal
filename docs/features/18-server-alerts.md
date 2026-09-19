# 后端提醒 Alerts

- **ID**: `server-alerts`
- **路由**: `/api/alerts/*`
- **状态**: DB `alert_configs` `alert_log`；`settings.volatility_monitor`
- **依赖**: auth；`marketService`（OKX/Binance 公共 K 线，经代理）；`mailer`（可选）

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/alerts/configs` | timeframes/thresholds 已 parse |
| POST | `/api/alerts/configs` | 按 (alert_type, exchange, symbol) upsert |
| POST | `/api/alerts/configs/batch` | 批量 |
| DELETE | `/api/alerts/configs/:id` | |
| GET | `/api/alerts/history?page&limit` | 告警日志倒序 |
| GET | `/api/alerts/monitor/status` | 运行状态 + 上次检测摘要 |
| POST | `/api/alerts/monitor/start` | 启动后台循环 |
| POST | `/api/alerts/monitor/stop` | 停止循环 |
| GET/PUT | `/api/alerts/monitor/settings` | `{ emailNotify, intervalSec }` 等 |
| POST | `/api/alerts/monitor/check` | 立即检测一轮（不启停定时器） |

稳定币脱锚与邮件见 [21-stablecoin](21-stablecoin.md)、[22-mailer](22-mailer.md)。

## 波动监测（真实后台）

- 文件：`server/src/services/volatilityMonitor.js`
- 数据：`getCandles(symbol, tf, 2, exchange)` — OKX `/api/v5/market/candles` 或 Binance futures klines（与 `agent-trade-kit` 的 market candles 同源，**不依赖 OKX CLI**）
- 判定：最新一根 K 线 **振幅** `(high-low)/open × 100%` ≥ 该周期阈值
- 去重：同一 `exchange|symbol|tf` 的同一根 K 线只写一次 `alert_log`
- 写库：命中 → `alert_log`（前端「告警历史」可刷到）
- 邮件：`settings.volatility_monitor.emailNotify` 且配置了 `EMAIL_*` 时，本轮命中合并发一封
- 循环：默认 60s（`intervalSec` 15–600）；进程启动时若有 `is_enabled=1` 的 volatility 配置会自动 `start`
- 隔离：单币拉行情失败只打日志，不拖垮整轮

## body 示例

```json
{
  "alert_type": "volatility",
  "exchange": "okx",
  "symbol": "BTC-USDT",
  "timeframes": ["5m"],
  "thresholds": { "5m": 3 },
  "is_enabled": 1
}
```

## 文件

- `server/src/services/volatilityMonitor.js` — 检测循环
- `server/src/services/marketService.js` — OKX/Binance K 线
- `repository.js` alert 段 + `insertAlertLog` + volatility_monitor settings
- `app.js` monitor 路由
- `index.js` 启动时 auto-start
- 前端：[07-alerts](07-alerts.md)

## 隔离边界

- 配置失败不影响博客/组合
- 无启用配置时定时器可不跑，不占行情配额
- 监测失败写 `settings.volatility_monitor.lastError`，不影响其他 API

## 变更记录

- 2026-09: CRUD + history；monitor 仅状态位
- 2026-09: **接真实波动监测**：定时拉 OKX/Binance K 线、写 alert_log、可选 SMTP 邮件；前端「同步并启动 / 立即检测」；启动 auto-arm

# 后端组合 Portfolio

- **ID**: `server-portfolio`
- **路由**: `/api/portfolio/*`
- **状态**: DB `position_records` + `settings.last_balance_*`
- **依赖**: auth

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/portfolio/overview?exchange&page&limit` | 只读 DB，不调交易所 |
| POST | `/api/portfolio/sync?exchange` | 同步钩子（当前返回 adapter 未启用 errors） |

### overview 响应

```json
{
  "totalEquity": 0,
  "unrealizedPnl": 0,
  "unrealizedPnlRatio": 0,
  "dailyPnl": 0,
  "dailyPnlRatio": 0,
  "currentPositions": [],
  "historizedPositions": [],
  "pnlCurve": [{ "date": "YYYY-MM-DD", "value": 0 }],
  "historyPagination": { "page": 1, "limit": 5, "total": 0 }
}
```

## 文件

- `server/src/services/repository.js` → `getPortfolioOverview`
- `server/src/app.js` portfolio 段
- 示例数据：`server/src/db/seed.js`

## 如何接入真实交易所同步

1. 在 `services/` 新建 `okxSync.js` / `binanceSync.js`（用 `proxyFetch` + HMAC）
2. 替换 `POST /api/portfolio/sync`：
   - 拉当前仓位 → upsert `status=open`
   - 拉历史 → upsert `status=closed`
   - 写 `settings.last_balance_okx|binance`
   - 失败 push `syncResult.errors`
3. 更新本文档「接入状态」

可选：冷却 120s 存 `settings.last_sync_<exchange>`（原项目行为）。

## 隔离边界

- overview 永不因交易所宕机而 500（只读库）
- sync 失败带 errors，HTTP 仍可 200

## 变更记录

- 2026-09: 读库 overview + sync 钩子占位

# 投资组合 Portfolio

- **ID**: `portfolio`
- **路由**: `#/portfolio`
- **状态**: 无（服务端 DB）
- **依赖**: 登录；`api.portfolioOverview` / `portfolioSync`；水晶组件

## 用户可见行为

1. **交易所水晶**（单选）：OKX / Binance / 统一（=all）
2. **刷新数据**：POST sync，显示冷却/错误横幅
3. **概览卡**：总权益、持仓浮盈、当前持仓数、历史平仓数（数字动画）
4. **收益曲线**：canvas 贝塞尔填充
5. **当前持仓 / 历史平仓** 卡片网格 + 历史分页

## 文件清单

- `js/pages/portfolio.js`
- `css/pages/portfolio.css`
- 共享：`shared.renderCrystal` / `renderExchangeBadge`
- 图标：`js/components/exchange-icons.js`（OKX/Binance/统一 SVG）
- 后端：`GET/POST /api/portfolio/*`（见 [17-server-portfolio](17-server-portfolio.md)）

## 数据流

```
exchange (unified→all) + page
  → GET /api/portfolio/overview
  → paint() 更新卡片/表格/canvas
点击刷新
  → POST /api/portfolio/sync
  → syncResult.errors / cooldown 提示
```

未登录：`#positions-grid` 显示「去登录」，不请求私有接口。

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 卡片指标 | `overview-cards` HTML + `paint()` |
| 曲线样式 | `drawCurve()` |
| 持仓字段 | `renderPositionCard()` |
| 接入真实同步 | 服务端 `app.js` `POST /api/portfolio/sync` adapter |
| 历史每页 | `load()` 里 `limit: 5` |

## 隔离边界

- 只依赖 auth + portfolio API
- 曲线 canvas 尺寸跟父容器；无数据时画「暂无收益数据」
- 同步失败不重置已有 overview（错误横幅）

## 变更记录

- 2026-09: 未登录友好提示；水晶重绘改为 paintCrystal
- 2026-09: 交易所节点改为矢量品牌图标（`exchange-icons.js`）；按官方图重绘（OKX 五方块 / Binance 金菱）

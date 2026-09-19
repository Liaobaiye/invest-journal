# 首页 Home

- **ID**: `home`
- **路由**: `#/`
- **状态**: 无本地存储
- **依赖**: `api.listPosts` / `api.ticker` / `api.candles` / `api.stats`

## 用户可见行为

1. **Hero**：徽章「市场观察中」+ 大标题渐变字 + CTA「浏览博客 / 查看组合」
2. **行情环**：BTC/USDT 价格、24h 涨跌、呼吸圆环、12 根迷你 K 线
3. **统计条**：文章数、评论数、BTC 价、BTC 24h（数字滚动）
4. **市场律动**：40 根日 K 柱状图
5. **最新文章**：最多 3 张 BlogCard

## 文件清单

- `js/pages/home.js`
- `css/pages/home.css`（类前缀 `.home-page` / `.hero` / `.stat-card` / `.candle-*`）

## 数据流

```
HomePage → api.ticker + api.candles + api.listPosts + api.stats
        → 按时间升序整理 K 线（OKX 返回最新在前）
        → 更新 #btc-price / #candle-bars / #home-posts / #stat-*
```

- 行情失败：`api.js` 演示模式提供假 K 线/价格
- 文章列表：服务端 `/api/posts?limit=3`
- 「市场律动」：`candle-bars` 随左栏卡片拉高，柱体按 high–low 全距绘制

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 换默认交易对 | `loadMarket()` 里 `api.ticker('BTC-USDT')` |
| 改统计项 | `#stats-row` 模板 + `animateNumber` |
| 改 Hero 文案 | `main.innerHTML` 模板字符串 |
| 迷你 K 线数量 | `renderMiniCandles(..., parsed.slice(-12))` |
| 市场律动柱高/留白 | `css/pages/...` `.candle-bars` + `renderCandles` 的 `padPct` |

## 隔离边界

- 只操作 `#app-main` 内节点
- 行情失败不阻断文章加载（两个独立 async）
- 不 import 其他 page

## 变更记录

- 2026-09: 演示模式行情 + 真实 posts
- 2026-09: 修复市场律动：K 线时间轴改为旧→新、图区加高随卡片拉伸、柱体留白与 tooltip

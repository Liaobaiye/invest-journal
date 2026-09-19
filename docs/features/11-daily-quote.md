# 每日开屏语录 Daily Quote

- **ID**: `daily-quote`
- **路由**: 无（启动时可能全屏遮罩）
- **状态**: `localStorage.myweb_last_quote_date`（YYYY-MM-DD）
- **依赖**: 无

## 用户可见行为

- 当天首次访问：全屏星空 + 语录淡入 +「轻触任意处进入」
- 点击或 8 秒后消失；当天不再出现

## 文件清单

- `js/data/splash-quotes.js` — **语录内容（改这里）**
- `js/components/daily-quote.js`（挂载 `#quote-root`，逻辑）
- `css/components.css` `.quote-splash` `.quote-text`

## 语录数据

单独文件 `js/data/splash-quotes.js`：

```js
export const SPLASH_QUOTES = [
  '如果结局不让你满意\n那就不是结局',
  // 加一条：'第一行\n第二行'
];
```

与页脚 `js/data/footer-taglines.js` **同一格式**：纯字符串数组。

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| **加/改开屏语录** | 只改 `js/data/splash-quotes.js` |
| 关闭该功能 | `app.js` 不调用 `mountDailyQuote()` |
| 改停留时长 | `daily-quote.js` `setTimeout(dismiss, 8000)` |
| 从服务端拉语录 | 在 `mountDailyQuote` 里 fetch，失败用 `SPLASH_QUOTES` |

## 隔离边界

- 遮罩在 `#quote-root`，dismiss 后清空 innerHTML
- 不影响路由与页面模块

## 变更记录

- 2026-09: 初版
- 2026-09: 语录抽出为 `js/data/splash-quotes.js`；格式统一为纯字符串（与 footer-taglines 一致）

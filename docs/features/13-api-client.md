# API 客户端与演示模式

- **ID**: `api-client`
- **路由**: 无
- **状态**: `localStorage.accessToken`；页面顶部 demo banner
- **依赖**: `store.js` auth

## 行为

1. 所有请求经 `js/api.js` → `/api`，带 `credentials: include`
2. 请求头附 `Authorization: Bearer <accessToken>`
3. **401**：尝试 `POST /api/auth/refresh`，排队重试；失败清 token → `#/login`
4. **演示模式**：网络错误或 HTTP ≥500（且非业务 4xx）时返回内置假数据，并 `window.dispatchEvent('demo-mode')` 显示横幅；`source: market|backend` 区分文案；真实 API 恢复后去掉横幅

## 命名空间

| 导出 | 用途 |
|------|------|
| `api.login/check/logout` | 鉴权 |
| `api.listPosts/getPost/createPost/updatePost/deletePost/aiComment` | 博客 |
| `api.listComments/createComment/deleteComment` | 评论 |
| `api.ticker/candles` | 行情 |
| `api.portfolioOverview/portfolioSync` | 组合 |
| `api.listAlertConfigs/saveAlertConfig/alertHistory/monitor*` | 提醒 |
| `api.listExchanges/addExchange/.../getSite/updateSite` | 设置 |
| `api.stats` | 首页统计 |

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 加接口 | 在对应 namespace 加方法；服务端同步加路由 |
| 关掉演示模式 | `withDemo` 改为直接 `requestFn()` |
| 改 base | `const BASE = '/api'` |
| 超时 | 可在 `request` 用 AbortController |

## 隔离边界

- 唯一前端 HTTP 出口；业务页禁止裸 `fetch`
- demo 只影响数据，不改变路由

## 变更记录

- 2026-09: 演示模式 + 401 刷新队列
- 2026-09: 演示横幅区分「行情/代理」与「后端未连」

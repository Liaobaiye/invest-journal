# 应用壳 Shell

- **ID**: `shell`
- **路由**: 全局（所有页面）
- **状态**: `localStorage.theme`
- **依赖**: 无

## 用户可见行为

- 深色/浅色主题背景层（光晕、极光、点阵、漂浮几何 canvas）
- 顶栏、主内容区、页脚、主题球、确认框、每日语录挂载点
- hash 路由切换页面，带 blur+位移动画
- 路由守卫：需登录页无 token 时跳 `#/login?redirect=`

## 文件清单

| 文件 | 职责 |
|------|------|
| `index.html` | 挂载点与 CSS 入口 |
| `js/app.js` | boot：挂壳组件、注册路由、恢复会话 |
| `js/router.js` | hash 路由、参数、守卫、页面 try/catch |
| `css/tokens.css` | 设计变量（颜色/圆角/缓动） |
| `css/base.css` | reset、滚动条、主题过渡 |
| `css/layout.css` | 背景层、header、main、footer |
| `js/utils/motion.js` | `applyReveal`、背景 canvas、确认框、数字动画 |

## 路由表

| hash | 页面模块 | 需登录 |
|------|----------|--------|
| `#/` | `pages/home.js` | 否 |
| `#/blog` | `pages/blog.js` | 否 |
| `#/blog/new` | `pages/blog-editor.js` | 是 |
| `#/blog/:id` | `pages/blog-detail.js` | 否 |
| `#/blog/:id/edit` | `pages/blog-editor.js` | 是 |
| `#/portfolio` | `pages/portfolio.js` | 否 |
| `#/alerts` | `pages/alerts.js` | 否 |
| `#/altcoin` | `pages/altcoin.js` | 否（启动扫描需登录） |
| `#/stablecoins` | 重定向 → `#/alerts` | 否 |
| `#/settings` | `pages/settings.js` | 是 |
| `#/login` | `pages/login.js` | 否 |

## 如何修改

1. **加页面**：`app.js` 里 `route('/path', { component, requiresAuth, title })`；新建 `js/pages/xxx.js` 导出 `async function XxxPage(main, { params, query })`；新建 `css/pages/xxx.css` 并在 `index.html` 引入。
2. **改配色**：改 `tokens.css`，勿在页面里写死色值。
3. **改路由行为**：只动 `router.js`，页面勿直接解析 `location.hash` 业务逻辑（读 hash 高亮导航除外）。

## 隔离边界

- 壳不 import 任何 page 的内部实现
- 页面抛错 → `router.js` 显示「页面加载失败」，不影响 header/footer
- 背景 canvas 在 `visibilitychange` 时暂停

## 变更记录

- 2026-09: 初版 ESM 壳，无 Vue
- 2026-09: 新增路由 `#/stablecoins`（后并入提醒页，改为重定向）
- 2026-09: 新增路由 `#/altcoin`（山寨币监测）
- 2026-09: 导航高亮改为 render 开始时同步更新；加 renderSeq 丢弃过期导航
- 2026-09: 快速切页 AbortController；safePage 忽略过期页异常；页面 `alive()` 防护

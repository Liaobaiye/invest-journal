# 功能文档索引

每个 **UI 区块 / 业务功能** 一份文档。改代码前先读对应文档；改完后**必须**同步更新该文档。

阅读顺序建议：`AI_MAINTENANCE.md` → 本索引 → 具体 feature。

| 文档 | 功能 | 主要文件 |
|------|------|----------|
| [features/00-shell.md](features/00-shell.md) | 应用壳：背景、路由、布局 | `js/app.js`, `js/router.js`, `css/layout.css` |
| [features/01-home.md](features/01-home.md) | 首页 Hero / 行情环 / K线 / 统计 / 最新文章 | `js/pages/home.js`, `css/pages/home.css` |
| [features/02-blog-list.md](features/02-blog-list.md) | 博客列表、标签、分页 | `js/pages/blog.js`, `css/pages/blog.css` |
| [features/03-blog-detail.md](features/03-blog-detail.md) | 文章详情、Markdown、阅读进度 | `js/pages/blog-detail.js` |
| [features/04-comments.md](features/04-comments.md) | 评论与二级回复 | `js/pages/blog-detail.js` 内 `renderComments` |
| [features/05-blog-editor.md](features/05-blog-editor.md) | 写文章 / 编辑器双栏 | `js/pages/blog-editor.js`, `css/pages/editor.css` |
| [features/06-portfolio.md](features/06-portfolio.md) | 组合：水晶切换、权益、曲线、持仓 | `js/pages/portfolio.js`, `css/pages/portfolio.css` |
| [features/07-alerts.md](features/07-alerts.md) | 提醒：波动/回撤/消息面/**稳定币**/历史 | `js/pages/alerts.js`, `css/pages/alerts.css` |
| [features/08-settings.md](features/08-settings.md) | 设置：交易所 API、站点信息 | `js/pages/settings.js`, `css/pages/settings.css` |
| [features/09-login.md](features/09-login.md) | 登录页与会话 | `js/pages/login.js`, `css/pages/login.css` |
| [features/10-theme.md](features/10-theme.md) | 日夜主题切换球 | `js/components/theme-toggle.js` |
| [features/11-daily-quote.md](features/11-daily-quote.md) | 每日开屏语录 | `js/data/splash-quotes.js`, `daily-quote.js` |
| [features/12-header-footer.md](features/12-header-footer.md) | 顶栏导航与页脚 | `header.js`, `footer.js`, `js/data/footer-taglines.js` |
| [features/13-api-client.md](features/13-api-client.md) | 前端 API 客户端 + 演示模式 | `js/api.js`, `js/store.js` |
| [features/14-server-auth.md](features/14-server-auth.md) | 后端 JWT 鉴权 | `server/src/utils/jwt.js`, `middleware/auth.js` |
| [features/15-server-market.md](features/15-server-market.md) | 行情 + 代理（VPN） | `server/src/services/marketService.js`, `httpClient.js` |
| [features/16-server-blog.md](features/16-server-blog.md) | 博客/评论/统计 API | `server/src/services/repository.js` |
| [features/17-server-portfolio.md](features/17-server-portfolio.md) | 组合读库与同步钩子 | `server/src/app.js` portfolio 段 |
| [features/18-server-alerts.md](features/18-server-alerts.md) | 告警配置与历史 API | `repository.js` alert 段, `app.js` |
| [features/19-server-settings.md](features/19-server-settings.md) | 交易所密钥与站点设置 | `repository.js` settings 段 |
| [features/20-db.md](features/20-db.md) | JSON 文件库与 seed | `server/src/db/store.js`, `seed.js` |
| [features/21-stablecoin.md](features/21-stablecoin.md) | 稳定币脱锚（UI 在提醒页） | `mailer.js`, `stablecoinService.js`, `alerts.js` |
| [features/22-mailer.md](features/22-mailer.md) | SMTP 邮件通知 | `server/src/services/mailer.js` |
| [features/23-altcoin.md](features/23-altcoin.md) | 山寨币成交量异动监测 | `js/pages/altcoin.js`, `altcoinService.js` |
| [isolation.md](isolation.md) | 功能隔离原则 | — |

## 命名约定

- 文档 ID = 文件名去掉序号，如 `07-alerts` → 功能 ID `alerts`
- 前端路由 `#/alerts` ↔ 文档 `07-alerts.md`
- 后端接口前缀 `/api/alerts` ↔ 同一文档（若前后端同属一功能可合并，复杂则拆）

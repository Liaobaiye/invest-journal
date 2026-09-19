# 文章详情 Blog Detail

- **ID**: `blog-detail`
- **路由**: `#/blog/:id`
- **状态**: 无
- **依赖**: `api.getPost`、markdown 渲染、评论模块

## 用户可见行为

- 顶部阅读进度条（2px 金条）
- 返回链接、标签、标题、时间、预计阅读分钟
- Markdown 正文、可选「交易数据」卡片
- 管理员：编辑 / AI 评论 / 删除（确认框）
- 下方评论区（见 [04-comments](04-comments.md)）

## 文件清单

- `js/pages/blog-detail.js`（主流程 + `renderComments`）
- `js/components/trade-data-card.js`（**交易数据可视化**，不是 JSON dump）
- `js/utils/markdown.js`（轻量 MD，无 marked 依赖）
- `css/pages/blog.css`（`.blog-detail`, `.markdown-body`, `.trade-data-card`, `.td-*`）

## 数据流

```
params.id → api.getPost
  → tags JSON.parse
  → trade_data JSON.parse（空对象则不显示卡片）
  → renderMarkdown(content)
  → renderComments(postId)
```

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| MD 语法支持 | `utils/markdown.js` |
| 交易卡字段/版式 | `js/components/trade-data-card.js` + `blog.css` `.td-*` |
| 删除确认文案 | `bindActions` → `showConfirm` |
| 阅读时长算法 | `content.length / 400` |

## 隔离边界

- 详情加载失败：整页错误区 + 返回链接
- 删除/AI 失败：`alert`，不跳转
- 进度条监听在页面内，路由离开后由 SPA 换 main 清空 DOM（scroll 监听仍挂在 window，可接受；若要严格清理可在 router cleanup 卸载）

## 变更记录

- 2026-09: 初版
- 2026-09: 交易数据改为可视化卡片（计划 chips、止盈止损条、行情块、持仓行；字段中文化）

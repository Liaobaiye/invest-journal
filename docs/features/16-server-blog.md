# 后端博客 / 评论 / 统计

- **ID**: `server-blog`
- **路由**: `/api/posts*`、`/api/comments/:id`、`/api/stats`
- **状态**: DB `posts` `comments`
- **依赖**: [20-db](20-db.md)

## 接口摘要

| 方法 | 路径 | 鉴权 |
|------|------|------|
| GET | `/api/posts?page&limit&tag` | 公开；仅 published；tags/trade_data 为 JSON **字符串** |
| GET | `/api/posts/:id` | 公开；草稿需登录 |
| POST/PUT/DELETE | `/api/posts/:id` | Bearer |
| POST | `/api/posts/:id/ai-comment` | Bearer（无 AI 时写入固定审阅句） |
| GET/POST | `/api/posts/:postId/comments` | GET 公开；POST 公开（限流） |
| DELETE | `/api/comments/:id` | Bearer |
| GET | `/api/stats` | 公开 `{posts,comments}` |

## 文件

- `server/src/services/repository.js` — 全部读写
- `server/src/app.js` 路由

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 分页默认 | 路由 limit 10，上限 50 |
| 标签过滤 | `listPosts` tag === `p.tags.includes` |
| 真·AI 评论 | 在 ai-comment 路由调用 OpenAI-compatible API |
| 列表返回完整 content | 去掉 map 里 `content: undefined` |

## 隔离边界

- 与行情/组合无共享状态
- 删文章级联删评论

## 变更记录

- 2026-09: 与原 API 形状对齐（list 无 content）

# 评论 Comments

- **ID**: `comments`
- **路由**: 随文章详情 `#/blog/:id` 渲染（无独立路由）
- **状态**: 无
- **依赖**: `api.listComments` / `createComment` / `deleteComment`，`isAuthenticated`

## 用户可见行为

- 昵称 + 正文 + 发表
- 评论列表；`is_ai` 显示紫色 AI 徽章
- 行内「回复」二级缩进（`parent_id`）
- 管理员悬停显示删除 ×，经确认框删除

## 文件清单

- `js/pages/blog-detail.js` 内函数 `renderComments(el, postId)`
- 样式：`css/pages/blog.css` `.comment-*`

## API

| 方法 | 路径 |
|------|------|
| GET | `/api/posts/:postId/comments` |
| POST | `/api/posts/:postId/comments` body `{ author_name, content, parent_id? }` |
| DELETE | `/api/comments/:id`（Bearer） |

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 嵌套层级 >2 | 目前仅一层；改 `paint()` 递归结构 |
| 评论排序 | `repository.listComments` |
| 提交校验 | 表单 `required maxlength` |

## 隔离边界

- 评论失败不导致正文消失（独立 `#comment-section`）
- 删除仅移除该 id 及直接子回复

## 变更记录

- 2026-09: 初版二级回复

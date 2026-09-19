# 博客编辑器 Editor

- **ID**: `blog-editor`
- **路由**: `#/blog/new`、`#/blog/:id/edit`（需登录）
- **状态**: 无（草稿靠「存草稿」写库 `is_published=0`）
- **依赖**: `api.getPost/createPost/updatePost/ticker`

## 用户可见行为

- 左：标题、摘要、标签、Markdown 正文、防抖预览
- 右上：交易所水晶（OKX/Binance）+ 拉取行情写入交易数据 JSON
- 右下：存草稿 / 发布（或保存修改）

## 文件清单

- `js/pages/blog-editor.js`
- `css/pages/editor.css`（`.editor-page`, `.editor-workspace`）

## 数据流

```
collect(published) → { title, content, summary, tags[], trade_data{}, is_published }
  → createPost 或 updatePost
  → hash 跳转详情或列表
```

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 增加 front-matter 字段 | 模板 + `collect()` + 后端 `createPost/updatePost` |
| 预览延迟 | `debounce 120ms` |
| 拉取更多行情类型 | `[data-fetch]` 按钮与 handler |
| 交易所切换 | `paintCrystal()` 内 `exchange` 变量 |

## 隔离边界

- 保存失败 `alert`，不丢已填内容
- 不 import 博客列表逻辑

## 变更记录

- 2026-09: 初版双栏

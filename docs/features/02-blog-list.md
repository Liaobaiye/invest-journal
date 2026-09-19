# 博客列表 Blog List

- **ID**: `blog-list`
- **路由**: `#/blog`，查询 `?page=&tag=`
- **状态**: 无
- **依赖**: `api.listPosts`，登录后显示「写文章」

## 用户可见行为

- 页头「博客」+ 管理员「写文章」按钮
- 标签筛选：独立玻璃卡片（标题「标签」+ 当前状态），内部 chip 为全量文章标签（次数降序，顺序稳定）
- 双列卡片；无标签且多于 1 篇时首篇通栏 featured
- 底部分页 上一页 / page / totalPages

## 文件清单

- `js/pages/blog.js`
- `css/pages/blog.css`（`.blog-page`, `.blog-card`, `.tag-rail`, `.pagination`）
- 卡片渲染：`js/components/shared.js` → `renderBlogCard`

## 数据流

```
路由 query { page, tag } → Promise.all([
  api.listPosts({ page, limit: 10, tag }),
  api.listPosts({ page: 1, limit: 100, tag: '' })  // 仅用于稳定标签栏
]) → 渲染 #blog-posts + #tag-rail + #blog-pagination
```

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 每页条数 | `api.listPosts({ limit: 10 })` |
| 卡片样式 | `shared.renderBlogCard` + `blog.css` |
| 标签来源 | `loadAllTags()`：全量文章聚合，次数降序；勿改回「当前页标签」 |
| 选中标签 | `location.hash = '#/blog?tag=...'` |

## 隔离边界

- 不读写 auth store（只 `isAuthenticated()` 判断按钮）
- 列表失败仅空态提示

## 变更记录

- 2026-09: 初版
- 2026-09: 标签栏改为全量聚合，顺序稳定，不再随筛选结果重排/消失
- 2026-09: 标签收进独立 `.tag-panel` 小卡片

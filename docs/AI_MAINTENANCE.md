# AI 维护提示词（必读）

你在维护 **投资日志**（`newweb`）项目。本文件是给后续 AI/开发者的工作约定。

## 开工前

1. 读根目录 [README.md](../README.md)
2. 读 [INDEX.md](INDEX.md) 找到**你要动的功能**对应文档
3. 完整读该 feature 文档，再改代码
4. 若涉及跨功能（鉴权、API 客户端、路由），同时读 [13-api-client.md](features/13-api-client.md) / [14-server-auth.md](features/14-server-auth.md) / [00-shell.md](features/00-shell.md)

## 改完后（强制）

| 你做了什么 | 必须同步 |
|------------|----------|
| 改了某功能的 UI/逻辑/API | 更新对应 `docs/features/*.md`（行为、接口、文件路径、状态存储键） |
| 新增功能/新页面 | **新建** `docs/features/NN-xxx.md`，并在 `INDEX.md` 登记 |
| 改了路由 | 更新 `00-shell.md` 路由表 |
| 改了全局样式 token | 更新 `00-shell.md` 或新建 token 说明 |
| 改了 `.env` 变量 | 更新相关 feature 文档 + `.env.example` |
| 删除功能 | 在 INDEX 标记废弃，不要留下死文档链接 |

## 文档模板（新功能照抄）

```markdown
# 功能名

- **ID**: `kebab-id`
- **路由**: `#/path`（或「无页面，仅服务端」）
- **状态**: localStorage key / 服务端表
- **依赖**: 其他 feature ID（无则写「无」）

## 用户可见行为
## 文件清单
## 数据流
## 如何修改
## 隔离边界（崩了会影响谁）
## 变更记录
```

## 隔离原则（见 [isolation.md](isolation.md)）

- 一个功能出错，**不得**拖垮其他页面：页面入口已有 try/catch；新页面必须导出 `async function XxxPage(main, ctx)` 并自行兜底
- 禁止在 A 功能里直接改 B 功能的 DOM 根节点
- 共享只允许：`js/api.js`、`js/store.js`、`js/utils/*`、设计 token
- 重量资源（WebSocket、长轮询、大 canvas）若共用，必须可按功能开关

## 禁止事项

- 不要在未读 feature 文档的情况下「顺手重构」整个页面
- 不要为单次需求引入新框架/构建工具（本项目为无构建 ESM + 轻量 Express）
- 不要把密钥写进前端或文档
- 不要让某个 feature 的 CSS 污染全局（页面样式放 `css/pages/*`，组件样式放 `components.css`）

## 自检清单

```text
[ ] 相关 feature md 已更新
[ ] INDEX.md 若是新功能已添加
[ ] 前端无未捕获异常（浏览器 console）
[ ] 相关 API 冒烟（curl 或 scripts/）
[ ] 未改动无关功能文件
```

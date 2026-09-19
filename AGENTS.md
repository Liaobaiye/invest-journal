# AGENTS.md — 给 AI 的项目约定

本项目是 **投资日志**（无构建 ESM 前端 + 轻量 Express）。

## 必读（按顺序）

1. [README.md](README.md) — 启动与结构
2. [docs/AI_MAINTENANCE.md](docs/AI_MAINTENANCE.md) — **维护协议（强制）**
3. [docs/INDEX.md](docs/INDEX.md) — 功能文档目录
4. [docs/isolation.md](docs/isolation.md) — 功能隔离

## 改动前

- 在 INDEX 中定位要动的功能，读完对应 `docs/features/*.md` 再改代码
- 不要跨功能「顺手重构」

## 改动后（强制）

- 更新该功能的 md（行为、文件、API、状态键）
- **新功能**：新建 `docs/features/NN-xxx.md` 并登记 INDEX
- 路由/壳变更：更新 `00-shell.md`

## 技术约束

- 前端：原生 ESM，无 Vue/React/构建器；页面导出 `async function XxxPage(main, ctx)`
- 新页面必须用 `safePage()` 包装（见 `js/app.js`）
- HTTP 只走 `js/api.js`；出网只走 `server/src/services/httpClient.js`
- 国内访问 OKX/Binance：必须配置 `server/.env` 代理（见 15-server-market.md）

## 默认账号（开发）

`admin` / `admin123`（改 `.env` 后需重新 seed 或改库）

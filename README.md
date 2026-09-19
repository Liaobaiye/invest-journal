# 投资日志 — 模块化重构版

原项目体积约 180MB（主要是 `node_modules`）。本重构改为**无构建步骤的原生 ES Module 前端 + 轻量 Express 后端**，源码体积仅数百 KB，依赖大幅减少。

## 结构

```
newweb/
├── index.html          # SPA 入口
├── AGENTS.md           # 给 AI 的强制约定
├── docs/               # ★ 每个功能一份 md + AI 维护协议
│   ├── AI_MAINTENANCE.md
│   ├── INDEX.md
│   ├── isolation.md
│   └── features/       # 00-shell … 20-db
├── .mimocode/skills/feature-docs/   # 可复用 skill
├── css/
├── js/
│   ├── app.js          # safePage 注册路由
│   ├── router.js / api.js / store.js
│   ├── components/ pages/ utils/
└── server/src/
```

## 文档怎么读（人 + AI）

| 你是谁 | 路径 |
|--------|------|
| 第一次接手 | [docs/INDEX.md](docs/INDEX.md) → 对应功能 md |
| AI / 自动改代码 | **必读** [AGENTS.md](AGENTS.md) → [docs/AI_MAINTENANCE.md](docs/AI_MAINTENANCE.md) |
| 要加/改某功能 | 打开 INDEX 里该功能的 md，改完 **必须回写文档** |
| 关心隔离/故障边界 | [docs/isolation.md](docs/isolation.md) |

功能文档一览（完整表见 INDEX）：壳 / 首页 / 博客列表 / 详情 / 评论 / 编辑器 / 组合 / 提醒 / 设置 / 登录 / 主题 / 语录 / 顶栏页脚 / API 客户端 / 鉴权 / 行情代理 / 博客后端 / 组合后端 / 提醒后端 / 设置后端 / DB / 稳定币 / 邮件。

## 功能对照

| 功能 | 说明 |
|------|------|
| 首页 | Hero + BTC 行情环 + K 线 + 统计 + 最新文章 |
| 博客 | 列表 / 标签筛选 / 分页 / 详情 / Markdown / 评论二级回复 |
| 编辑器 | 双栏工作区、草稿/发布、交易数据附注 |
| 组合 | 交易所水晶切换、权益卡、收益曲线、持仓卡片、同步冷却提示 |
| 提醒 | 波动/回撤/消息面/**稳定币脱锚**、本地持久化、告警历史、邮件通知 |
| 设置 | 交易所 API、站点信息（仅返回公开字段） |
| 登录 | JWT access + refresh cookie |
| 主题 | 右下角日/夜切换球 + 全屏波纹 |
| 开屏语录 | 每日一次星空语录 |
| 邮件通知 | SMTP（163/QQ/Gmail），脱钩告警 / 测试邮件 |
| 稳定币脱锚 | 提醒页第四卡，可增删币种，脱钩可发邮件 |

## 快速开始

```bash
# 1) 配置代理（国内访问 OKX/Binance 必配）
cd server
cp .env.example .env
# 编辑 .env 中的 HTTP_PROXY / HTTPS_PROXY，例如：
#   HTTP_PROXY=http://127.0.0.1:7897
#   HTTPS_PROXY=http://127.0.0.1:7897
# Clash/V2Ray 请选 香港/日本/新加坡/台湾 节点（Binance 拒绝美国出口 IP 451）

# 2) 安装并启动
npm install && npm run seed && npm start
# 打开 http://localhost:3000

# 3) 管理员
# 默认 admin / admin123（可用 .env 修改后重新 seed）
```

### 代理说明

| 项 | 说明 |
|----|------|
| 配置位置 | `server/.env` 的 `HTTP_PROXY` / `HTTPS_PROXY` |
| 生效范围 | 所有 OKX / Binance REST 请求（经 undici `ProxyAgent`） |
| 未配置时 | 服务仍可启动，行情接口返回 502 + 提示文案，前端回落演示数据 |
| 查看状态 | `GET /api/market/proxy` |
| 常用端口 | Clash `7897`，V2Ray `10809`，SS `1080` |

私有接口（余额/持仓）同样会走该代理；密钥仍在 `#/settings` 配置。

## 相对原项目的优化

1. **体积**：去掉 Vue/Vite/TypeScript 客户端工具链与 sql.js WASM；前端零依赖，后端仅 express 生态。
2. **模块化**：页面、组件、样式、服务按目录拆分；每个功能独立 md；页面用 `safePage` 隔离异常。
3. **功能隔离**：单页 API 失败/抛错只影响该页；行情代理失败不影响博客读库（详见 isolation.md）。
4. **Bug 修复**：
   - 设置页不再泄漏内部 `settings` 键（余额缓存/同步游标等）
   - 交易所配置更新不再写入不存在的 `updated_at` 列
   - 博客 tags 在前端一致解析
   - 演示模式：后端不可达时仍可浏览 UI
5. **可扩展**：交易所同步预留 adapter（见 [docs/features/17-server-portfolio.md](docs/features/17-server-portfolio.md)）。

## API 一览

与原项目对齐：`/api/auth/*`、`/api/posts*`、`/api/comments/:id`、`/api/market/*`、`/api/portfolio/*`、`/api/alerts/*`、`/api/settings/*`、`/api/stats`、`/api/health`。

## 说明

- 前端 hash 路由，与原项目一致。
- 数据默认存在 `server/src/data/db.json`（原子写入；目录已在 `.gitignore`）。
- 行情接口经 `HTTP_PROXY`/`HTTPS_PROXY` 访问 OKX/Binance；未配置代理或节点不可达时前端回落到演示数据。
- 余额/私有持仓同步与回撤监测需要在「设置 → 交易所」配置 API Key。

## GitHub 更新网站

代码建议托管在 **GitHub Private 仓库**；服务器通过 `git pull` + `pm2 reload` 热更。

### 不要上传

`server/.env`、`server/src/data/`、`server/data/`、`node_modules/`（已在 `.gitignore`）。

### 本机首次

```bat
cd newweb
git init
git add .
git commit -m "init"
git remote add origin https://github.com/<你>/<仓库>.git
git branch -M main
git push -u origin main
```

之后日常更新：

```bat
bash scripts/git-push.sh "改了什么"
```

或手动：`git add -A && git commit -m "..." && git push`

### 服务器首次

```bash
git clone https://github.com/<你>/<仓库>.git /opt/newweb
cd /opt/newweb/server
cp .env.example .env   # 在服务器上填写真实密钥，不要提交
npm install
npm run seed
pm2 start src/index.js --name myweb && pm2 save && pm2 startup
```

### 服务器每次更新

```bash
cd /opt/newweb
bash scripts/deploy-server.sh
```

| 改动类型 | 更新后 |
|----------|--------|
| 仅前端 js/css/html | pull 后浏览器 Ctrl+F5 即可 |
| 后端 server/src | `deploy-server.sh` 会 `pm2 reload` |
| 改了 `.env` / 装依赖 | 用 `pm2 restart myweb`，reload 读不到新 env |

可选：把 `.github/workflows/deploy.yml.example` 复制为 `deploy.yml`，配置 SSH Secrets 后可 push 自动部署。

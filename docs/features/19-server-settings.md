# 后端设置 Settings

- **ID**: `server-settings`
- **路由**: `/api/settings/*`
- **状态**: DB `exchange_config`、`settings.site_*`
- **依赖**: auth

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings/exchange` | 列表，**不含**密钥字段 |
| POST | `/api/settings/exchange` | 按 exchange upsert；存 api_key/secret/passphrase |
| DELETE | `/api/settings/exchange/:id` | |
| PATCH | `/api/settings/exchange/:id/toggle` | 启用开关 |
| GET | `/api/settings/site` | **仅** `site_title` `site_description` |
| PUT | `/api/settings/site` | 白名单更新 |

## 安全

- 生产应把密钥列改为 AES-256-GCM（当前为演示明文 JSON，**上线前必须加密**）
- GET site 已修：不再返回 `last_balance_*` 等内部键

## 文件

- `repository.js` settings/exchange 段
- 前端：[08-settings](08-settings.md)

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 加密存储 | `upsertExchange` 写入前 encrypt；读出 adapter decrypt |
| 加站点字段 | `putSite` 白名单 + 前端表单 + 本文档 |
| 加密钥轮换 | 新增 settings 键 + 管理接口 |

## 隔离边界

- 密钥接口独立；泄漏面控制在 auth 后

## 变更记录

- 2026-09: site 接口收窄字段；exchange upsert 不再写 updated_at

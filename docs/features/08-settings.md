# 设置 Settings

- **ID**: `settings`
- **路由**: `#/settings`（需登录）
- **状态**: 服务端 DB（密钥加密列）
- **依赖**: `api.listExchanges/addExchange/deleteExchange/toggleExchange/getSite/updateSite`

## 用户可见行为

### 交易所 API（左）
- 已配置列表：交易所名、备注、启用/停用、删除
- 添加表单：OKX/Binance；OKX 显示 Passphrase；Key/Secret
- 保存后服务端存储（前端不回显明文）

### 站点信息（右）
- 站点标题 / 描述
- 保存成功/失败横幅
- 安全提示：密钥仅服务端加密

## 文件清单

- `js/pages/settings.js`
- `css/pages/settings.css`（`.settings-page`, `.ex-row`）
- 后端：[19-server-settings](19-server-settings.md)

## 数据流

```
GET /api/settings/exchange → 列表（无密钥）
POST /api/settings/exchange { exchange, api_key, secret_key, passphrase?, label? }

交易所密钥被 **回撤监测** 使用（拉持仓浮盈，只读）。OKX 必须填 passphrase。
PATCH .../toggle  DELETE .../:id
GET/PUT /api/settings/site { site_title, site_description }
```

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 新交易所 | `#ex-select` option + 后端 `upsertExchange` |
| 站点更多字段 | 前端表单 + 后端 `putSite` 白名单（**必须同步加白名单**） |
| 列表展示 | `loadExchanges()` |

## 隔离边界

- 仅 auth 路由；失败 alert/横幅
- 不触碰组合/提醒 DOM

## 变更记录

- 2026-09: 站点接口只返回 site_* 字段（修泄漏）

# 后端鉴权 Auth

- **ID**: `server-auth`
- **路由**: `/api/auth/*`
- **状态**: access JWT 15m；refresh cookie 7d（httpOnly, path=/api/auth）
- **依赖**: `.env` JWT_ACCESS_SECRET / JWT_REFRESH_SECRET

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/api/auth/login` | 公开 + 限流 | `{username,password}` → `{accessToken,username}` + Set-Cookie |
| POST | `/api/auth/refresh` | cookie | 轮换 refresh，返回新 access |
| GET | `/api/auth/check` | Bearer | `{authenticated,username}` |
| POST | `/api/auth/logout` | 无 | 清 cookie |

## 文件

- `server/src/utils/jwt.js` — 签发/校验/cookie
- `server/src/middleware/auth.js` — `authenticate` / `optionalAuthenticate`
- `server/src/app.js` auth 段
- seed 管理员：`db/seed.js`

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 改 TTL | `jwt.js` expiresIn |
| 改 cookie 属性 | `setRefreshCookie` |
| 多用户/角色 | `users` 表 + login 校验；middleware 注入 `req.role` |
| 吊销 refresh | 需服务端黑名单表（当前无） |

## 隔离边界

- 仅保护挂了 `authenticate` 的路由
- 公开：health/stats/posts 列表/详情/评论 GET/行情 ticker/candles

## 变更记录

- 2026-09: 与原项目双令牌语义对齐

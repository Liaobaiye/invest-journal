# 登录 Login

- **ID**: `login`
- **路由**: `#/login?redirect=`
- **状态**: `localStorage.accessToken`；cookie `refreshToken`
- **依赖**: `api.login`；`store.setAuth`

## 用户可见行为

- 左品牌栏：logo、slogan、三特性
- 右表单：用户名/密码、错误横幅、登录按钮
- 成功后跳转 `redirect` 或 `#/`
- 顶栏变为已登录（用户点 + 退出）

## 文件清单

- `js/pages/login.js`
- `css/pages/login.css`
- 后端：[14-server-auth](14-server-auth.md)

## 流程

```
submit → POST /api/auth/login
  → accessToken 存 localStorage
  → setAuth({ user, token })
  → location.hash = redirect || '#/'
```

401 刷新见 [13-api-client](13-api-client.md)。

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 品牌文案/特性 | `.login-brand` 模板 |
| 登录字段 | 表单 + 后端 login body |
| 失败提示 | `#login-error` |

## 隔离边界

- 登录失败只显示错误，不改路由
- 退出逻辑在 header，不在本页

## 变更记录

- 2026-09: 初版

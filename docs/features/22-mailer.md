# SMTP 邮件通知 Mailer

- **ID**: `mailer`
- **路由**: 无页面（由提醒/稳定币触发）
- **状态**: `.env` `EMAIL_USER` / `EMAIL_AUTH_CODE` / `EMAIL_TO`
- **依赖**: nodemailer

## 行为

- 按发件域名自动选 SMTP：163 / QQ / Gmail → 465 SSL；其他 `smtp.<domain>`
- 同步 `sendMail()` 返回 Promise；后台用 `sendMailFireAndForget`
- 稳定币检测命中脱钩且开启通知时调用 `sendStablecoinDepegEmail`
- **山寨币**自动/手动扫描有异动时调用 `sendAltcoinSpikeEmail`（见 [23-altcoin.md](23-altcoin.md)）
- **波动监测**命中且 `volatility_monitor.emailNotify` 时，由 `volatilityMonitor.js` 调用 `sendMail` + `renderVolatilityAlertEmail*`
- **回撤 / 消息面 / 稳定币自动扫** 命中时由 `alertsMonitor.js` 发信（见 [07-alerts](07-alerts.md)）

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/settings/email/status` | Bearer | `{ configured, user, to }` |
| POST | `/api/settings/email/test` | Bearer | 发送测试邮件 |

## 文件

- `server/src/services/mailer.js` — 发送
- `server/src/services/emailTemplates.js` — **HTML/纯文本模板（美化邮件改这里）**
- `.env.example` EMAIL_* 段

## 邮件版式

- 深色卡片 + 金色强调（与站点主题一致）
- 表格布局 + 内联样式，兼容 163/QQ/Gmail 网页端
- 同时提供 `text` 回退，纯文本客户端可读

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 改配色/布局 | `emailTemplates.js` 的 `shell()` |
| 改测试邮件文案 | `renderTestEmailHtml/Text` |
| 改脱钩邮件表格列 | `renderDepegEmailHtml` |
| 改山寨币异动邮件 | `renderAltcoinSpikeEmailHtml/Text` + `sendAltcoinSpikeEmail` |
| 改波动告警邮件 | `renderVolatilityAlertEmailHtml/Text` |
| 改回撤/消息邮件 | `renderDrawdownEmail*` / `renderNewsAlertEmail*` |
| 新告警类型 | 新 `renderXxx` + mailer 导出 |

## 配置示例

```env
EMAIL_USER=you@163.com
EMAIL_AUTH_CODE=smtp-auth-code
EMAIL_TO=you@163.com
```

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 新 SMTP 提供商 | `getTransporter` smtpMap |
| 新告警模板 | 新增 `sendXxxEmail` |
| 在网页改收件人 | 需把 EMAIL_TO 改成 DB 设置（当前仅 .env） |

## 隔离边界

- 未配置时 `isEmailConfigured()=false`，调用方应降级（不中断业务）
- 发信失败只 toast/记日志，不抛到未捕获导致进程退出（fire-and-forget）

## 变更记录

- 2026-09: 从原项目 notifier 迁移；支持稳定币脱钩 + 测试接口
- 2026-09: 163 真机联调通过（测试邮件 + 脱钩邮件 `sent:true`）；`.env` 已恢复未配置状态
- 2026-09: HTML 美化模板 `emailTemplates.js`（深色卡片 + 表格 + text 回退）；本地预览 `scripts/preview-email.js`
- 2026-09: 新增山寨币异动汇总邮件 `sendAltcoinSpikeEmail`（统计卡 + Top15 表 + **完整网址**报告链接）
- 2026-09: 新增波动监测命中邮件模板 `renderVolatilityAlertEmail*`（由 volatilityMonitor 调用 sendMail）

# 稳定币脱锚监测 Stablecoin Depeg

- **ID**: `stablecoins`
- **路由**: **UI 在 `#/alerts` 第四张卡**；旧路由 `#/stablecoins` 重定向到 `#/alerts`
- **状态**: 服务端 `settings.stablecoin_config`（`{ coins[], threshold, emailNotify }`）
- **依赖**: 登录；代理；[22-mailer](22-mailer.md)（可选邮件）

## 用户可见行为（提醒页内）

1. 币种 chips，可 × 移除；输入框添加
2. 阈值（默认 0.005）
3. 勾选「脱钩发邮件」
4. **勾选「自动扫描」** 后点「保存并同步」：服务端按 `intervalSec`（默认 300s）自动检测
5. 检测 / 保存并同步 / 测试邮件
6. 表格：价格、偏离%、状态；摘要条数
7. 命中脱钩且开启邮件 → 发信并写入告警历史（自动扫描有 30 分钟/币种冷却）

自动扫描实现见 [07-alerts](07-alerts.md) / `alertsMonitor.js`。

## 文件清单

| 文件 | 职责 |
|------|------|
| `js/pages/alerts.js` | `stablecoinCardShell` + `bindStablecoin` |
| `css/pages/alerts.css` | `.alerts-page .sc-*` |
| `js/api.js` | `stablecoinConfig/save/check/emailStatus/sendTestEmail` |
| `server/src/services/stablecoinService.js` | Coinbase 检测 |
| `server/src/services/mailer.js` | 脱钩邮件 |
| `server/src/app.js` | `/api/stablecoins/*`、`/api/settings/email/*` |
| `stablecoin_depeg.py` | 独立 CLI |

独立整页 `js/pages/stablecoin.js` 仍保留代码，但不再注册路由（可删或另开）。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/api/stablecoins/config` | coins / threshold / emailNotify |
| GET | `/api/stablecoins/check?coins&threshold&notify` | 检测；notify=1 时脱钩发信 |
| POST | `/api/settings/email/test` | 测试邮件 |
| GET | `/api/settings/email/status` | SMTP 是否已配置 |

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 默认币种/阈值 | `stablecoinService.js` |
| 自动扫描 | config `autoScan`/`intervalSec` + `alertsMonitor.js` |
| 拆回独立页 | 恢复 app.js 路由 + header NAV |

## 隔离边界

- 仅提醒页一张卡 + 专属 API；失败不影响波动/回撤卡片
- 邮件失败只提示，不阻断检测结果展示
- 自动扫描命中写 `alert_log`，同币种约 30 分钟冷却防刷屏

## 变更记录

- 2026-09: Web 版独立页
- 2026-09: **并入提醒页**；接 SMTP；旧 `#/stablecoins` 重定向
- 2026-09: 修复 `runCheck`：增删币种自动检测不再误发邮件（仅手动「检测」尊重勾选）
- 2026-09: **服务端自动扫描**（`autoScan` + 间隔）；命中进历史并可发邮件

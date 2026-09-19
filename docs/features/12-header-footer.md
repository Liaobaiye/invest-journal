# 顶栏与页脚 Header / Footer

- **ID**: `chrome`
- **路由**: 全局
- **状态**: 无
- **依赖**: `authState`；`api.logout`

## 用户可见行为

### Header
- Logo「投资日志」
- 导航：首页 / 博客 / 组合 / 提醒 / 山寨币（当前项 ink 下划线）
- 已登录：绿点 + 用户名 + 退出；未登录：登录
- 滚动 >20px：底边与阴影

### Footer
- Logo + 随机 tagline（每次刷新随机）
- © 年份「数据自有，思想自由」

## 文件清单

- `js/components/header.js` → `#app-header`
- `js/components/footer.js` → `#app-footer`
- `js/data/footer-taglines.js` — **页脚语录（改这里）**
- 样式：`css/layout.css`

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 加导航项 | `header.js` `NAV` 数组（hash + icon + label） |
| **加/改页脚语录** | 只改 `js/data/footer-taglines.js`（字符串数组，push 即可） |
| 退出后行为 | `handleLogout` 里 `location.hash` |

## 隔离边界

- header 订阅 `authState` 自动重绘
- 不 import 任何 page

## 变更记录

- 2026-09: 初版
- 2026-09: tagline 抽出为 `js/data/footer-taglines.js`
- 2026-09: 导航曾增加「稳定币」，后并入提醒页并移除该项
- 2026-09: 导航增加「山寨币」→ `#/altcoin`

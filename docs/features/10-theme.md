# 主题切换 Theme Toggle

- **ID**: `theme`
- **路由**: 全局悬浮球（右下角）
- **状态**: `localStorage.theme` = `dark` | `light`
- **依赖**: `tokens.css` 双套变量

## 用户可见行为

- 暗色 = **新月**（金黄月牙 + 陨石坑）；亮色 = **太阳**（光盘 + 八道光芒自转）
- **默认休眠**：半透明、缩小；鼠标进入右下角约 **140px** 内「苏醒」——放大亮起、光晕呼吸
- 无文字 tooltip（仅 `title`/`aria-label`）
- 离开后约 0.7–0.9s 再次休眠；切换主题后会短暂保持亮着再睡
- 点击：全屏圆形波纹展开后切换 `html[data-theme]`
- 触屏：常显（半透明），点击放大；支持键盘 Tab + Enter/Space

## 文件清单

- `js/components/theme-toggle.js`（挂载 `#theme-root`，SVG 月/日 + 邻近检测）
- `css/components.css` `.theme-orb` `.theme-wave` `.orb-core` `.orb-moon` `.orb-sun`

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 苏醒半径 | `theme-toggle.js` 里 `HOT = 140` |
| 默认主题 | `index.html` 的 `data-theme` + mount 时读 storage |
| 波纹时长 | `setTimeout 400` + CSS `.theme-wave.active` |
| 位置 | `.theme-orb` bottom/right |
| 月/日造型 | `theme-toggle.js` 内联 SVG |
| 新主题色 | 必须在 `tokens.css` 补齐变量，禁止只改单页 |

## 隔离边界

- 只改 `documentElement` 属性与 `#theme-root`
- 不依赖任何 page

## 变更记录

- 2026-09: 初版
- 2026-09: 月/日 SVG 形态；默认休眠 + 邻近苏醒动画
- 2026-09: 修复切换主题后球无法休眠：不再依赖 `:hover`，用 hovering 标志 + 指针坐标复核
- 2026-09: 月牙下移居中，与太阳同一圆心交叉过渡，消除高度跳动
- 2026-09: 月↔日形变动画；修复鼠标持续移动时休眠定时器被不断重置；去掉中心闪光，只保留形变
- 2026-09: 性能：去掉 SVG drop-shadow/filter；月/日改为 HTML 层 transform；缓存球心 + rAF 节流
- 2026-09: 波纹改为全屏 opacity 遮罩（盖住后再切 data-theme）；去掉 box-shadow 圆环；形变时收起光晕
- 2026-09: 修复苏醒放大后停顿：光晕只动 opacity，呼吸/浮动延迟启动，缩短 wake 过渡
- 2026-09: 切换提速：去掉全屏遮罩与旋转，月日仅 opacity+scale 交叉约 0.32s
- 2026-09: 去掉「切换日间/夜间」tooltip 文字

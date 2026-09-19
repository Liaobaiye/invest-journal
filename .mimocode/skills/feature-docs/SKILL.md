---
name: feature-docs
description: 维护按功能隔离的文档体系。当用户要求在本项目新增/修改 UI 或功能，或创建「功能文档 / AI 维护约定」时使用。强制：改功能必更新对应 docs/features/*.md，新功能必新建 md 并登记 INDEX，并遵守 isolation 原则。
---

# feature-docs — 功能级文档维护

本 skill 要求：**每个 UI/业务功能一份文档**；AI 在改动前后遵循固定协议，保证功能可隔离、可交接。

## 适用项目形态

已为 `newweb`（投资日志）落地；也可复制到其他「多页面/多功能」项目。

## 标准目录

```
docs/
  AI_MAINTENANCE.md   # 给 AI 的强制协议
  INDEX.md            # 功能 ↔ 文档索引
  isolation.md        # 隔离原则
  features/
    NN-kebab-name.md  # 每个功能一份
AGENTS.md             # 指向上述文档
README.md             # 「文档怎么读」表
.mimocode/skills/feature-docs/SKILL.md
```

## 工作流

### 接到「改某功能」

1. 读 `docs/INDEX.md` 找到功能文档
2. 读该 `features/*.md`（行为、文件、数据流、隔离边界）
3. 只改该功能相关文件
4. **回写文档** + 变更记录一行

### 接到「新功能 / 新 UI」

1. 设计为独立模块（新 `js/pages/*` 或 service），禁止塞进无关页面
2. 新建 `docs/features/NN-xxx.md`（用下方模板）
3. 登记 `INDEX.md`
4. 路由用 `safePage()` 包装；API 失败有 UI 兜底
5. 更新 `AGENTS.md` 若有新全局约定

### 文档模板

```markdown
# 功能名
- **ID**: kebab-id
- **路由**: #/path 或「仅服务端」
- **状态**: localStorage 键 / DB 集合
- **依赖**: 其他 ID 或「无」

## 用户可见行为
## 文件清单
## 数据流
## 如何修改
## 隔离边界
## 变更记录
```

## 隔离检查清单

- [ ] 页面不 import 其他 page
- [ ] 只写 `#app-main` 或自己的挂载点
- [ ] CSS 限定在页面根 class
- [ ] HTTP 只走统一 api/httpClient
- [ ] 单功能失败不导致整站白屏

## 在 newweb 中的入口

- 协议：`docs/AI_MAINTENANCE.md`
- 索引：`docs/INDEX.md`
- 隔离：`docs/isolation.md`
- 根提示：`AGENTS.md`

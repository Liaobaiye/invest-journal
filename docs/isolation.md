# 功能隔离原则

目标：**一个功能坏了，其他功能仍可用**。

## 分层

```
index.html
  └── app.js（壳：挂载 header/footer/theme，注册路由）
        ├── pages/*     每页独立模块，互不 import
        ├── components/* 仅被页面/壳引用，页面之间不互引
        ├── api.js      唯一 HTTP 出口
        └── store.js    唯一前端共享状态（auth）

server/
  app.js 路由 → services/*（market / repository / httpClient）
```

## 前端规则

1. **页面不互相 import**  
   `home.js` 不得 `import { PortfolioPage }`。跳转用 `location.hash`。

2. **页面入口必须自容错**  
   路由器对页面抛错有兜底；页面内部对「加载失败」必须渲染错误区，不要空白。

3. **DOM 所有权**  
   - 页面只写 `#app-main` 内部  
   - 壳组件只写自己的挂载点（`#app-header` 等）  
   - 禁止 `document.body` 上堆业务节点（主题球/语录/确认框除外，已有专用 root）

4. **CSS 隔离**  
   - 页面类名挂在页面根 class 下（如 `.alerts-page .alert-card`）  
   - 全局类仅限 `btn-*`、`form-*`、`glass-card`、`section-title` 等工具类

5. **失败策略**  
   | 故障 | 期望 |
   |------|------|
   | 某页 API 500/502 | 该页错误提示；其他页正常 |
   | 行情代理失败 | 首页演示数据；博客仍读本地库 |
   | 未登录访问受保护数据 | 该区块引导登录，不整站白屏 |

6. **演示模式**  
   `api.js` 网络失败时进入 demo（见 [13-api-client](features/13-api-client.md)），只影响数据源，不改变路由结构。

## 后端规则

1. **路由模块化**  
   新接口写在对应 feature 的 service 或 `app.js` 独立段；不要在 auth 路由里塞行情逻辑。

2. **交易所适配器**  
   私有同步失败应返回 `syncResult.errors[]`，不得抛到未捕获导致进程退出。

3. **DB**  
   `store.js` 原子写；单功能读写失败不应损坏其他集合。

4. **代理**  
   仅 `httpClient.proxyFetch` 出网；业务代码禁止裸 `fetch` 外网。

## 何时可以打破隔离

仅当：该能力被 ≥3 个功能重度共用，且抽取成本低于复制（如 `proxyFetch`、`markdown`、`icons`）。抽取后仍须写 feature 文档说明「被谁依赖」。

## 新增功能检查

- [ ] 独立 `js/pages/*` 或独立 service
- [ ] 独立 `docs/features/NN-*.md`
- [ ] 无对其他 page 的直接依赖
- [ ] API 失败有 UI 兜底
- [ ] CSS 限定在页面/组件作用域

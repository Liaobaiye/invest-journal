# 行情与代理 Market + Proxy

- **ID**: `server-market`
- **路由**: `/api/market/*`
- **状态**: `.env` HTTP_PROXY / HTTPS_PROXY
- **依赖**: undici ProxyAgent

## 为什么需要代理

国内无法直连 OKX / Binance。配置 Clash/V2Ray 本地端口后，服务端所有交易所 REST 走代理。

**Binance 拒绝美国出口 IP（451）→ 选港/日/新/台节点。**

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/market/proxy` | 公开 | `{configured, enabled, url, hint}` |
| GET | `/api/market/ticker?instId&exchange` | 公开 | 归一化 last/open24h/... |
| GET | `/api/market/candles?instId&bar&limit&exchange` | 公开 | 数组 `[ts,o,h,l,c,v]` 最新在前 |
| GET | `/api/market/balance` | Bearer | 未实现 adapter → 501 |

`exchange`: `okx` \| `binance`；Binance 符号去掉 `-`。

## 文件

- `server/src/env.js` — 加载 `.env`，导出 PROXY_URL
- `server/src/services/httpClient.js` — `proxyFetch` / `proxyJson`
- `server/src/services/marketService.js` — OKX/Binance 公共 API

## 配置示例

```env
HTTP_PROXY=http://127.0.0.1:7897
HTTPS_PROXY=http://127.0.0.1:7897
```

## 如何修改

| 需求 | 改哪里 |
|------|--------|
| 换代理端口 | `.env` 后重启 |
| 加交易所 | `marketService.js` 新函数 + 路由 |
| 私有 balance | 在 balance 路由调用带 HMAC 的 client（复用 proxyFetch） |
| 改超时 | `proxyFetch(url, opt, timeoutMs=12000)` |

## 隔离边界

- 代理失败 → 502 + `hint`；前端演示模式
- 未配置代理：服务仍启动，启动日志 warn

## 变更记录

- 2026-09: undici ProxyAgent；OKX/Binance ticker+klines 实测通过

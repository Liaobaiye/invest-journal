/**
 * 交易所 HTTP 客户端 — 走系统/Clash 代理
 *
 * 国内无法直连 OKX / Binance，必须配置 HTTP(S)_PROXY，
 * 例如 Clash 默认 http://127.0.0.1:7897（请选港/日/新/台节点，美国出口 IP 会被 Binance 451）。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { PROXY_URL } from '../env.js';

let agent = null;
if (PROXY_URL) {
  try {
    agent = new ProxyAgent(PROXY_URL);
    console.log(`[proxy] exchange traffic → ${PROXY_URL}`);
  } catch (e) {
    console.error('[proxy] invalid PROXY url, falling back to direct:', e.message);
  }
} else {
  console.warn('[proxy] no HTTP_PROXY/HTTPS_PROXY set — OKX/Binance will likely fail in CN networks');
}

/** fetch that goes through Clash/V2Ray when proxy is configured */
export async function proxyFetch(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await undiciFetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      ...(agent ? { dispatcher: agent } : {}),
      headers: {
        'User-Agent': 'myweb-server/2.0',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function proxyJson(url, options = {}, timeoutMs = 12000) {
  const res = await proxyFetch(url, options, timeoutMs);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      `HTTP ${res.status} ${res.statusText} — ${typeof body === 'object' ? JSON.stringify(body).slice(0, 200) : text.slice(0, 200)}`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function proxyEnabled() {
  return !!agent;
}

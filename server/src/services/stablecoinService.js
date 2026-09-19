/**
 * 稳定币脱锚检测 — Coinbase 公开 spot，经 proxyFetch
 * 逻辑对齐 stablecoin_depeg.py
 */
import { proxyJson } from './httpClient.js';

export const PEG = 1.0;
export const DEFAULT_COINS = ['USDT', 'USDC', 'DAI', 'PYUSD', 'GUSD', 'USD1', 'BUSD'];
export const DEFAULT_THRESHOLD = 0.005; // 0.5%

const API_BASE = 'https://api.coinbase.com/v2/prices';

export function severityOf(deviation, threshold) {
  if (threshold <= 0) return 'error';
  const ratio = Math.abs(deviation) / threshold;
  if (ratio >= 3) return 'critical';
  if (ratio >= 1.5) return 'warn';
  if (ratio >= 1) return 'depeg';
  return 'ok';
}

export async function fetchSpot(symbol, timeoutMs = 10000) {
  const data = await proxyJson(
    `${API_BASE}/${encodeURIComponent(symbol)}-USD/spot`,
    {},
    timeoutMs
  );
  const amount = data?.data?.amount;
  if (amount == null) throw new Error('响应缺少 amount');
  const price = Number(amount);
  if (!Number.isFinite(price)) throw new Error('价格无效');
  return {
    symbol: symbol.toUpperCase(),
    price,
    currency: data.data.currency || 'USD',
  };
}

export async function checkCoins(coins, threshold, timeoutMs = 10000) {
  const thr = Math.abs(Number(threshold) || DEFAULT_THRESHOLD);
  const results = [];
  for (const raw of coins) {
    const symbol = String(raw || '').trim().toUpperCase();
    if (!symbol) continue;
    try {
      const quote = await fetchSpot(symbol, timeoutMs);
      const deviation = quote.price - PEG;
      const depegged = Math.abs(deviation) >= thr;
      results.push({
        symbol,
        price: quote.price,
        deviation,
        deviation_pct: deviation * 100,
        deviation_bps: deviation * 10000,
        depegged,
        severity: severityOf(deviation, thr),
        error: null,
      });
    } catch (e) {
      const msg = String(e.message || e);
      results.push({
        symbol,
        price: null,
        deviation: null,
        deviation_pct: null,
        deviation_bps: null,
        depegged: false,
        severity: 'error',
        error: /404|Not Found/i.test(msg) ? '交易对不存在' : msg.slice(0, 200),
      });
    }
  }
  return {
    peg: PEG,
    threshold: thr,
    timestamp_utc: new Date().toISOString(),
    source: 'coinbase_v2_spot',
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.severity === 'ok').length,
      depegged: results.filter((r) => r.depegged).length,
      errors: results.filter((r) => r.severity === 'error').length,
    },
  };
}

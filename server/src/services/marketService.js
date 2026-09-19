/**
 * 行情服务 — OKX / Binance 公共接口，统一经 proxyFetch
 * 符号：OKX 用 BTC-USDT；Binance 去掉横线 BTCUSDT
 */
import { proxyJson } from './httpClient.js';

const OKX_BASE = process.env.OKX_API_BASE_URL || 'https://www.okx.com';
const BINANCE_BASE = process.env.BINANCE_FAPI_BASE || 'https://fapi.binance.com';

function toBinanceSymbol(instId) {
  return String(instId || 'BTCUSDT').replace(/-/g, '').toUpperCase();
}

const BAR_MAP = {
  '1m': { okx: '1m', binance: '1m' },
  '5m': { okx: '5m', binance: '5m' },
  '15m': { okx: '15m', binance: '15m' },
  '1H': { okx: '1H', binance: '1h' },
  '4H': { okx: '4H', binance: '4h' },
  '1D': { okx: '1D', binance: '1d' },
  '1W': { okx: '1W', binance: '1w' },
};

export async function getTicker(instId = 'BTC-USDT', exchange = 'okx') {
  if (exchange === 'binance') {
    const symbol = toBinanceSymbol(instId);
    const d = await proxyJson(`${BINANCE_BASE}/fapi/v1/ticker/24hr?symbol=${symbol}`);
    return {
      last: Number(d.lastPrice),
      open24h: Number(d.openPrice),
      high24h: Number(d.highPrice),
      low24h: Number(d.lowPrice),
      vol24h: Number(d.volume),
      exchange: 'binance',
      instId,
    };
  }
  const d = await proxyJson(`${OKX_BASE}/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`);
  const t = d.data?.[0];
  if (!t) throw new Error('OKX empty ticker');
  return {
    last: Number(t.last),
    open24h: Number(t.open24h),
    high24h: Number(t.high24h),
    low24h: Number(t.low24h),
    vol24h: Number(t.vol24h),
    exchange: 'okx',
    instId,
    raw: t,
  };
}

export async function getCandles(instId = 'BTC-USDT', bar = '1D', limit = 40, exchange = 'okx') {
  const mapped = BAR_MAP[bar] || BAR_MAP['1D'];
  if (exchange === 'binance') {
    const symbol = toBinanceSymbol(instId);
    const d = await proxyJson(
      `${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${mapped.binance}&limit=${limit}`
    );
    // Binance oldest-first → newest-first
    return d.reverse().map((k) => [String(k[0]), k[1], k[2], k[3], k[4], k[5]]);
  }
  const d = await proxyJson(
    `${OKX_BASE}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${mapped.okx}&limit=${limit}`
  );
  return d.data || [];
}

export function proxyHint() {
  return '若国内无法访问，请在 server/.env 配置 HTTP_PROXY/HTTPS_PROXY（如 http://127.0.0.1:7897），并选择非美国节点（Binance 拒绝美国出口 IP）。';
}

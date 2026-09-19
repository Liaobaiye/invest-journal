/**
 * 交易所私有 API — 持仓/权益（HMAC 签名，经 proxyFetch）
 * 密钥来自 settings → exchange_config（设置页配置）
 * OKX 需要：api_key / secret / passphrase，权限：只读
 * Binance 合约需要：api_key / secret，权限：只读
 */
import crypto from 'node:crypto';
import { proxyFetch } from './httpClient.js';
import { listExchangeCredentials, getExchangeCredentials } from './repository.js';

const OKX_BASE = process.env.OKX_API_BASE_URL || 'https://www.okx.com';
const BINANCE_BASE = process.env.BINANCE_FAPI_BASE || 'https://fapi.binance.com';

async function proxyJsonAuth(url, options = {}, timeoutMs = 12000) {
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
      `HTTP ${res.status} — ${typeof body === 'object' ? JSON.stringify(body).slice(0, 240) : text.slice(0, 240)}`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function hmacSha256Base64(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64');
}

function hmacSha256Hex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/** OKX 持仓（统一账户 / 合约 upl） */
export async function fetchOkxPositions(cred) {
  const ts = new Date().toISOString();
  const method = 'GET';
  const path = '/api/v5/account/positions?instType=SWAP';
  const sign = hmacSha256Base64(cred.secretKey, `${ts}${method}${path}`);
  const data = await proxyJsonAuth(`${OKX_BASE}${path}`, {
    headers: {
      'OK-ACCESS-KEY': cred.apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': ts,
      'OK-ACCESS-PASSPHRASE': cred.passphrase || '',
      'Content-Type': 'application/json',
    },
  }, 15000);
  if (data.code && String(data.code) !== '0') {
    throw new Error(`OKX ${data.code}: ${data.msg || 'positions error'}`);
  }
  return (data.data || [])
    .filter((p) => Number(p.pos) !== 0)
    .map((p) => ({
      exchange: 'okx',
      symbol: p.instId,
      posSide: (p.posSide || (Number(p.pos) >= 0 ? 'long' : 'short')).toLowerCase(),
      size: Number(p.pos) || 0,
      avgPx: Number(p.avgPx) || 0,
      markPx: Number(p.markPx) || 0,
      upl: Number(p.upl) || 0,
      uplRatio: Number(p.uplRatio) || 0,
      lever: Number(p.lever) || 0,
      margin: Number(p.margin) || Number(p.imr) || 0,
      raw: p,
    }));
}

/** OKX 账户权益（可选） */
export async function fetchOkxBalance(cred) {
  const ts = new Date().toISOString();
  const method = 'GET';
  const path = '/api/v5/account/balance?ccy=USDT';
  const sign = hmacSha256Base64(cred.secretKey, `${ts}${method}${path}`);
  const data = await proxyJsonAuth(`${OKX_BASE}${path}`, {
    headers: {
      'OK-ACCESS-KEY': cred.apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': ts,
      'OK-ACCESS-PASSPHRASE': cred.passphrase || '',
      'Content-Type': 'application/json',
    },
  }, 15000);
  const detail = data?.data?.[0]?.details?.[0] || data?.data?.[0];
  return Number(detail?.eq || detail?.cashBal || 0) || 0;
}

/** Binance USDT-M 持仓风险 */
export async function fetchBinancePositions(cred) {
  const ts = Date.now();
  const query = `timestamp=${ts}&recvWindow=10000`;
  const sign = hmacSha256Hex(cred.secretKey, query);
  const data = await proxyJsonAuth(`${BINANCE_BASE}/fapi/v2/positionRisk?${query}&signature=${sign}`, {
    headers: { 'X-MBX-APIKEY': cred.apiKey },
  }, 15000);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .filter((p) => Number(p.positionAmt) !== 0)
    .map((p) => {
      const amt = Number(p.positionAmt) || 0;
      return {
        exchange: 'binance',
        symbol: p.symbol,
        posSide: amt >= 0 ? 'long' : 'short',
        size: Math.abs(amt),
        avgPx: Number(p.entryPrice) || 0,
        markPx: Number(p.markPrice) || 0,
        upl: Number(p.unRealizedProfit) || 0,
        uplRatio: Number(p.unRealizedProfit) && Number(p.isolatedWallet)
          ? Number(p.unRealizedProfit) / Number(p.isolatedWallet)
          : 0,
        lever: Number(p.leverage) || 0,
        margin: Number(p.isolatedMargin) || Number(p.isolatedWallet) || 0,
        raw: p,
      };
    });
}

export async function fetchBinanceBalance(cred) {
  const ts = Date.now();
  const query = `timestamp=${ts}&recvWindow=10000`;
  const sign = hmacSha256Hex(cred.secretKey, query);
  const data = await proxyJsonAuth(`${BINANCE_BASE}/fapi/v2/balance?${query}&signature=${sign}`, {
    headers: { 'X-MBX-APIKEY': cred.apiKey },
  }, 15000);
  const usdt = (Array.isArray(data) ? data : []).find((x) => x.asset === 'USDT');
  return Number(usdt?.balance || usdt?.crossWalletBalance || 0) || 0;
}

/**
 * 汇总所有已配置交易所的当前持仓
 * @returns {{ positions: array, balances: object, errors: string[], configured: string[] }}
 */
export async function fetchAllOpenPositions() {
  const creds = listExchangeCredentials();
  const positions = [];
  const balances = {};
  const errors = [];
  const configured = creds.map((c) => c.exchange);

  await Promise.all(
    creds.map(async (c) => {
      try {
        if (c.exchange === 'okx') {
          const ps = await fetchOkxPositions(c);
          positions.push(...ps);
          try {
            balances.okx = await fetchOkxBalance(c);
          } catch { /* balance optional */ }
        } else if (c.exchange === 'binance') {
          const ps = await fetchBinancePositions(c);
          positions.push(...ps);
          try {
            balances.binance = await fetchBinanceBalance(c);
          } catch { /* optional */ }
        } else {
          errors.push(`${c.exchange}: 暂不支持`);
        }
      } catch (e) {
        errors.push(`${c.exchange}: ${e.message || e}`);
      }
    })
  );

  return { positions, balances, errors, configured };
}

export function hasExchangeCredentials() {
  return listExchangeCredentials().length > 0;
}

export function credentialSummary() {
  return listExchangeCredentials().map((c) => ({
    exchange: c.exchange,
    hasPassphrase: Boolean(c.passphrase),
  }));
}

// re-export for tests
export { getExchangeCredentials };

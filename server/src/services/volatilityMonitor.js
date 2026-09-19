/**
 * 波动监测 — 定时拉 OKX/Binance K 线，振幅超阈值写 alert_log，可选邮件
 * 行情走 marketService（OKX 公共 API，与 agent-trade-kit 的 market candles 同源）
 */
import { getCandles } from './marketService.js';
import { isEmailConfigured, sendMail } from './mailer.js';
import {
  listEnabledAlertConfigs,
  insertAlertLog,
  getVolatilityMonitorSettings,
  saveVolatilityMonitorSettings,
} from './repository.js';
import { renderVolatilityAlertEmailHtml, renderVolatilityAlertEmailText } from './emailTemplates.js';

const DEFAULT_INTERVAL_MS = 60_000;

let timer = null;
let ticking = false;
let running = false;

/** 同一 K 线只报一次 */
const lastBarKey = new Map();

export function isVolatilityMonitorRunning() {
  return running;
}

export function getVolatilityMonitorStatus() {
  const cfg = getVolatilityMonitorSettings();
  return {
    running,
    ticking,
    emailConfigured: isEmailConfigured(),
    emailNotify: cfg.emailNotify,
    intervalSec: cfg.intervalSec,
    lastRunAt: cfg.lastRunAt,
    lastError: cfg.lastError,
    lastHits: cfg.lastHits,
    watched: listEnabledAlertConfigs('volatility').length,
  };
}

function parseCandle(row) {
  // OKX / 本项目统一: [ts, o, h, l, c, vol, ...]
  if (!Array.isArray(row) || row.length < 5) return null;
  const openTime = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  if (![openTime, open, high, low, close].every((n) => Number.isFinite(n)) || !(open > 0)) {
    return null;
  }
  return { openTime, open, high, low, close };
}

/** 振幅% = (high-low)/open；涨跌% = (close-open)/open */
export function candleMetrics(candle) {
  const movePct = ((candle.close - candle.open) / candle.open) * 100;
  const ampPct = ((candle.high - candle.low) / candle.open) * 100;
  return { movePct, ampPct };
}

export async function checkVolatilityOnce() {
  const configs = listEnabledAlertConfigs('volatility');
  const cfg = getVolatilityMonitorSettings();
  const candidates = [];

  for (const c of configs) {
    const tfs = Array.isArray(c.timeframes) && c.timeframes.length ? c.timeframes : ['5m'];
    const thresholds = c.thresholds || {};
    for (const tf of tfs) {
      const thr = Number(thresholds[tf]);
      if (!(thr > 0)) continue;
      try {
        const rows = await getCandles(c.symbol, tf, 2, c.exchange || 'okx');
        const candle = parseCandle(rows?.[0]);
        if (!candle) continue;
        const { movePct, ampPct } = candleMetrics(candle);
        const barKey = `${c.exchange}|${c.symbol}|${tf}|${candle.openTime}`;
        // 只按振幅判定（与页面文案一致：短周期振幅超过阈值）
        if (ampPct < thr) continue;
        if (lastBarKey.get(`${c.exchange}|${c.symbol}|${tf}`) === barKey) continue;
        lastBarKey.set(`${c.exchange}|${c.symbol}|${tf}`, barKey);

        const dir = movePct >= 0 ? '↑' : '↓';
        const message = `${c.symbol} ${tf} 振幅 ${ampPct.toFixed(2)}%（${dir}${Math.abs(movePct).toFixed(2)}%）超过阈值 ${thr}% · ${String(c.exchange).toUpperCase()}`;
        candidates.push({
          alert_type: 'volatility',
          symbol: c.symbol,
          exchange: c.exchange,
          timeframe: tf,
          message,
          threshold_pct: thr,
          actual_pct: Number(ampPct.toFixed(4)),
          price: candle.close,
          movePct,
          ampPct,
        });
      } catch (e) {
        console.warn(`[VolMonitor] ${c.symbol}/${tf} ${c.exchange}:`, e.message || e);
      }
    }
  }

  let email = { sent: false, error: null, skipped: true };
  if (candidates.length && cfg.emailNotify) {
    email.skipped = false;
    if (!isEmailConfigured()) {
      email.error = '邮件未配置（EMAIL_*）';
    } else {
      try {
        await sendMail({
          subject: `【波动告警】${candidates.length} 条 · ${candidates[0].symbol}${candidates.length > 1 ? ' 等' : ''}`,
          text: renderVolatilityAlertEmailText(candidates),
          html: renderVolatilityAlertEmailHtml(candidates),
        });
        email.sent = true;
      } catch (e) {
        email.error = String(e.message || e);
      }
    }
  }

  const hits = candidates.map((c) => insertAlertLog({ ...c, notified: email.sent ? 1 : 0 }));

  try {
    saveVolatilityMonitorSettings({
      lastRunAt: new Date().toISOString(),
      lastError: null,
      lastHits: hits.length,
    });
  } catch { /* ignore */ }

  return { configs: configs.length, hits, email };
}

async function tick(reason = 'interval') {
  if (ticking) return;
  ticking = true;
  try {
    const r = await checkVolatilityOnce();
    if (r.hits.length) {
      console.log(`[VolMonitor] ${reason}: ${r.hits.length} hit(s)${r.email.sent ? ' + email' : ''}`);
    }
  } catch (e) {
    console.error('[VolMonitor] tick failed:', e.message || e);
    try {
      saveVolatilityMonitorSettings({ lastError: String(e.message || e) });
    } catch { /* ignore */ }
  } finally {
    ticking = false;
  }
}

export function startVolatilityMonitor({ intervalSec } = {}) {
  const cfg = getVolatilityMonitorSettings();
  const ms = Math.max(15, Number(intervalSec) || cfg.intervalSec || 60) * 1000;
  if (timer) clearInterval(timer);
  running = true;
  timer = setInterval(() => tick('interval'), ms);
  // 启动后尽快跑一轮，便于立刻看到历史
  setTimeout(() => tick('boot'), 2000);
  console.log(`[VolMonitor] started, interval=${ms / 1000}s`);
  return { running: true, intervalSec: ms / 1000 };
}

export function stopVolatilityMonitor() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  console.log('[VolMonitor] stopped');
  return { running: false };
}

/** 有启用中的波动配置则自动拉起 */
export function autoStartVolatilityMonitorIfArmed() {
  try {
    const armed = listEnabledAlertConfigs('volatility');
    if (!armed.length) return false;
    startVolatilityMonitor();
    return true;
  } catch (e) {
    console.error('[VolMonitor] auto-start failed:', e.message || e);
    return false;
  }
}

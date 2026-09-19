/**
 * 山寨币成交量异动扫描 — Binance 现货日线
 * 逻辑对齐 find spike volume with plot.ipynb
 * 附带：每 N 小时自动扫描 + 邮件开关、历史 HTML 报告
 */
import { proxyJson } from './httpClient.js';
import { isEmailConfigured, sendAltcoinSpikeEmail } from './mailer.js';
import { buildAltcoinReport } from './altcoinReport.js';
import { getAltcoinConfig, saveAltcoinConfig } from './repository.js';

const SPOT_BASE = process.env.BINANCE_SPOT_BASE || 'https://api.binance.com';
const SCHEDULER_MS = 60_000;

export const DEFAULTS = {
  threshold: 5,
  daysToCheck: 10,
  previousDays: 7,
  maxSymbols: 0, // 0 = 全量
  concurrency: 6,
};

const state = {
  running: false,
  postProcessing: false,
  done: 0,
  total: 0,
  current: null,
  startedAt: null,
  finishedAt: null,
  error: null,
  params: null,
  trigger: null,
};

let cache = {
  coins: [],
  scannedAt: null,
  params: null,
  totalSymbols: 0,
  durationMs: 0,
  source: 'binance_spot_1d',
  trigger: null,
  lastReport: null,
  lastNotify: null,
};

let schedulerTimer = null;

export function getScanStatus() {
  const cfg = getAltcoinConfig();
  return {
    ...state,
    autoScanEmail: cfg.autoScanEmail,
    intervalHours: cfg.intervalHours,
    nextAutoRunAt: nextAutoRunAt(cfg),
  };
}

export function getScanResult() {
  return { ...cache };
}

export function getAltcoinSettings() {
  const cfg = getAltcoinConfig();
  return {
    autoScanEmail: cfg.autoScanEmail,
    intervalHours: cfg.intervalHours,
    reportTopN: cfg.reportTopN,
    lastAutoRunAt: cfg.lastAutoRunAt,
    nextAutoRunAt: nextAutoRunAt(cfg),
    emailConfigured: isEmailConfigured(),
  };
}

export function updateAltcoinSettings(patch = {}) {
  const prev = getAltcoinConfig();
  const next = saveAltcoinConfig(patch);
  // 开启开关时：若从未跑过，从现在起计时 4h
  if (patch.autoScanEmail === true && !prev.lastAutoRunAt && !next.lastAutoRunAt) {
    saveAltcoinConfig({ lastAutoRunAt: new Date().toISOString() });
  }
  return getAltcoinSettings();
}

function nextAutoRunAt(cfg) {
  if (!cfg.autoScanEmail) return null;
  const last = cfg.lastAutoRunAt ? Date.parse(cfg.lastAutoRunAt) : Date.now();
  const base = Number.isFinite(last) ? last : Date.now();
  return new Date(base + cfg.intervalHours * 3600_000).toISOString();
}

export async function listUsdtSymbols() {
  const info = await proxyJson(`${SPOT_BASE}/api/v3/exchangeInfo`, {}, 25000);
  return (info.symbols || [])
    .filter((s) => s.status === 'TRADING' && s.symbol.endsWith('USDT'))
    .map((s) => s.symbol)
    .sort();
}

export async function fetchDailyKlines(symbol, limit = 18) {
  const rows = await proxyJson(
    `${SPOT_BASE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&limit=${Number(limit) || 18}`,
    {},
    12000
  );
  if (!Array.isArray(rows)) throw new Error('klines 非数组');
  return rows.map((k) => ({
    openTime: Number(k[0]),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    closeTime: Number(k[6]),
    quoteVolume: Number(k[7]),
  }));
}

/**
 * 量 > threshold × 前 previousDays 均量，且实体 ≤ 上影线
 * 返回首个命中日，否则 null
 */
export function detectSpike(candles, opts = {}) {
  const daysToCheck = Number(opts.daysToCheck) || DEFAULTS.daysToCheck;
  const previousDays = Number(opts.previousDays) || DEFAULTS.previousDays;
  const threshold = Number(opts.threshold) || DEFAULTS.threshold;
  const need = daysToCheck + previousDays;
  if (!Array.isArray(candles) || candles.length < need) return null;

  const data = candles.slice(-need);
  for (let i = previousDays; i < previousDays + daysToCheck; i++) {
    const cur = data[i];
    if (!cur || !(cur.volume > 0)) continue;
    const prev = data.slice(i - previousDays, i);
    const avg = prev.reduce((s, c) => s + (c.volume || 0), 0) / prev.length;
    if (!(avg > 0) || !(cur.volume > threshold * avg)) continue;

    const body = Math.abs(cur.close - cur.open);
    const upper = cur.high - Math.max(cur.close, cur.open);
    if (body <= upper) {
      return {
        date: new Date(cur.openTime).toISOString().slice(0, 10),
        openTime: cur.openTime,
        open: cur.open,
        high: cur.high,
        low: cur.low,
        close: cur.close,
        volume: cur.volume,
        quoteVolume: cur.quoteVolume,
        avgPrevVolume: avg,
        ratio: cur.volume / avg,
      };
    }
  }
  return null;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

/** 扫描结束后的报告 + 邮件，失败不抛出 */
async function afterScanComplete(scanPayload, { trigger, wantEmail }) {
  let report = null;
  let notify = { sent: false, error: null, skipped: true, configured: isEmailConfigured() };

  try {
    const cfg = getAltcoinConfig();
    report = await buildAltcoinReport(scanPayload, {
      topN: cfg.reportTopN,
      trigger,
      fetchKlines: fetchDailyKlines,
    });
  } catch (e) {
    report = { error: String(e.message || e) };
  }

  const n = scanPayload.coins?.length || 0;
  if (wantEmail && n > 0) {
    notify.skipped = false;
    if (!isEmailConfigured()) {
      notify.error = '邮件未配置：请设置 EMAIL_USER / EMAIL_AUTH_CODE / EMAIL_TO';
    } else {
      try {
        await sendAltcoinSpikeEmail({ ...scanPayload, trigger }, report && !report.error ? report : null);
        notify.sent = true;
        notify.at = new Date().toISOString();
      } catch (e) {
        notify.error = String(e.message || e);
      }
    }
  } else if (wantEmail && n === 0) {
    notify.skipped = true;
    notify.reason = 'no_hits';
  } else {
    notify.skipped = true;
    notify.reason = 'not_requested';
  }

  cache = {
    ...cache,
    ...scanPayload,
    trigger,
    lastReport: report,
    lastNotify: notify,
  };
}

export async function startScan(rawParams = {}) {
  if (state.running || state.postProcessing) {
    return { started: false, reason: 'already_running', status: getScanStatus() };
  }

  const trigger = rawParams.trigger === 'auto' ? 'auto' : 'manual';
  const cfg = getAltcoinConfig();
  let wantEmail;
  if (trigger === 'auto') {
    wantEmail = cfg.autoScanEmail;
  } else if (rawParams.emailNotify != null) {
    wantEmail = !!rawParams.emailNotify;
  } else {
    wantEmail = cfg.autoScanEmail;
  }

  const params = {
    threshold: Math.max(1, Number(rawParams.threshold) || DEFAULTS.threshold),
    daysToCheck: Math.max(1, Math.min(30, Number(rawParams.daysToCheck) || DEFAULTS.daysToCheck)),
    previousDays: Math.max(1, Math.min(30, Number(rawParams.previousDays) || DEFAULTS.previousDays)),
    maxSymbols: Math.max(0, Number(rawParams.maxSymbols) || 0),
    concurrency: Math.max(1, Math.min(12, Number(rawParams.concurrency) || DEFAULTS.concurrency)),
  };

  // 任意扫描都记下参数，供自动扫描沿用（避免仅内存、重启丢失）
  try {
    saveAltcoinConfig({ lastScanParams: params });
  } catch { /* ignore */ }

  state.running = true;
  state.postProcessing = false;
  state.done = 0;
  state.total = 0;
  state.current = null;
  state.error = null;
  state.params = params;
  state.trigger = trigger;
  state.startedAt = Date.now();
  state.finishedAt = null;

  // 自动扫描：一启动就记 lastAutoRunAt，失败也等下一周期，避免每分钟重试风暴
  if (trigger === 'auto') {
    try {
      saveAltcoinConfig({ lastAutoRunAt: new Date().toISOString() });
    } catch { /* ignore */ }
  }

  // 后台跑，立刻返回；前端轮询 status
  (async () => {
    try {
      const all = await listUsdtSymbols();
      let symbols = all;
      if (params.maxSymbols > 0) symbols = symbols.slice(0, params.maxSymbols);
      state.total = symbols.length;

      const needBars = params.daysToCheck + params.previousDays;
      const hits = await mapLimit(symbols, params.concurrency, async (symbol) => {
        state.current = symbol;
        try {
          const klines = await fetchDailyKlines(symbol, needBars);
          const spike = detectSpike(klines, params);
          state.done += 1;
          if (!spike) return null;
          return { symbol, ...spike };
        } catch {
          state.done += 1;
          return null;
        }
      });

      const coins = hits
        .filter(Boolean)
        .sort((a, b) => b.ratio - a.ratio)
        .map((c, i) => ({ rank: i + 1, ...c }));

      const scanPayload = {
        coins,
        scannedAt: new Date().toISOString(),
        params,
        totalSymbols: symbols.length,
        durationMs: Date.now() - state.startedAt,
        source: 'binance_spot_1d',
      };

      // 先落结果再放开 running，避免报告/邮件把进度条卡在 100%
      cache = {
        ...cache,
        ...scanPayload,
        trigger,
        lastReport: null,
        lastNotify: null,
      };
      state.finishedAt = Date.now();
      state.running = false;
      state.current = null;
      state.postProcessing = true;

      await afterScanComplete(scanPayload, { trigger, wantEmail });
    } catch (e) {
      state.error = String(e.message || e);
      state.finishedAt = Date.now();
    } finally {
      state.running = false;
      state.postProcessing = false;
      state.current = null;
    }
  })();

  return { started: true, status: getScanStatus() };
}

/** 服务端定时器：开关打开时每 intervalHours 自动扫一次 */
export function maybeRunAutoScan(reason = 'tick') {
  const cfg = getAltcoinConfig();
  if (!cfg.autoScanEmail) return { ran: false, reason: 'disabled' };
  if (state.running || state.postProcessing) {
    return { ran: false, reason: 'already_running' };
  }

  const last = cfg.lastAutoRunAt ? Date.parse(cfg.lastAutoRunAt) : NaN;
  const due = !Number.isFinite(last) || Date.now() - last >= cfg.intervalHours * 3600_000;
  if (!due) return { ran: false, reason: 'not_due', nextAutoRunAt: nextAutoRunAt(cfg) };

  const useCacheParams = cfg.lastScanParams || cache.params || DEFAULTS;
  const started = startScan({
    ...useCacheParams,
    trigger: 'auto',
  });
  if (started.started) {
    console.log(`[Altcoin] auto scan started (${reason})`);
  }
  return { ran: !!started.started, reason: started.reason };
}

export function startAltcoinScheduler() {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    try {
      maybeRunAutoScan('interval');
    } catch (e) {
      console.error('[Altcoin] scheduler error:', e.message || e);
    }
  }, SCHEDULER_MS);
  // 启动后 5s 先看一次是否已到期（服务重启场景）
  setTimeout(() => {
    try {
      maybeRunAutoScan('boot');
    } catch { /* ignore */ }
  }, 5000);
  console.log('[Altcoin] auto scheduler armed (check every 60s)');
}

export function stopAltcoinScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export function proxyHint() {
  return '若国内无法访问，请在 server/.env 配置 HTTP_PROXY/HTTPS_PROXY（如 http://127.0.0.1:7897），并选择非美国节点。';
}

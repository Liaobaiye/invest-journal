/**
 * 提醒页后台监测：稳定币自动扫 / 回撤 / 消息面
 * 与 volatilityMonitor 并列，统一由 index.js / alerts 路由启停
 */
import { proxyJson } from './httpClient.js';
import { isEmailConfigured, sendMail, sendStablecoinDepegEmail } from './mailer.js';
import { checkCoins, DEFAULT_COINS, DEFAULT_THRESHOLD } from './stablecoinService.js';
import { fetchAllOpenPositions, hasExchangeCredentials, credentialSummary } from './exchangePrivate.js';
import {
  insertAlertLog,
  getStablecoinConfig,
  saveStablecoinConfig,
  getDrawdownConfig,
  saveDrawdownConfig,
  getNewsConfig,
  saveNewsConfig,
} from './repository.js';
import {
  renderDrawdownEmailHtml,
  renderDrawdownEmailText,
  renderNewsAlertEmailHtml,
  renderNewsAlertEmailText,
} from './emailTemplates.js';

const running = {
  stablecoin: false,
  drawdown: false,
  news: false,
};
const timers = { stablecoin: null, drawdown: null, news: null };
const busy = { stablecoin: false, drawdown: false, news: false };
/** 稳定币：同一 symbol+方向 冷却，避免每轮重复告警 */
const scCooldown = new Map();
const SC_COOLDOWN_MS = 30 * 60 * 1000;
/** 新闻：已告警过的标题 */
const newsSeen = new Set();

function clearTimer(key) {
  if (timers[key]) {
    clearInterval(timers[key]);
    timers[key] = null;
  }
  running[key] = false;
}

// ---------- 稳定币自动扫 ----------
export async function checkStablecoinOnce({ sendEmail } = {}) {
  const cfg = getStablecoinConfig({ coins: DEFAULT_COINS, threshold: DEFAULT_THRESHOLD });
  const coins = cfg.coins?.length ? cfg.coins : DEFAULT_COINS;
  const result = await checkCoins(coins, cfg.threshold);
  const depegged = (result.results || []).filter((r) => r.depegged);
  const wantEmail = sendEmail != null ? sendEmail : cfg.emailNotify;
  const now = Date.now();
  const fresh = depegged.filter((r) => {
    const key = `${r.symbol}|${r.severity}`;
    const last = scCooldown.get(key) || 0;
    return now - last >= SC_COOLDOWN_MS;
  });

  let email = { sent: false, error: null, skipped: true };
  const hits = [];
  for (const r of fresh) {
    const row = insertAlertLog({
      alert_type: 'stablecoin',
      symbol: r.symbol,
      exchange: 'coinbase',
      timeframe: '',
      message: `${r.symbol} 脱锚 $${Number(r.price).toFixed(6)} 偏离 ${Number(r.deviation_pct).toFixed(4)}%（${r.severity}）`,
      threshold_pct: Number((cfg.threshold * 100).toFixed(4)),
      actual_pct: r.deviation_pct,
      price: r.price,
      notified: 0,
    });
    scCooldown.set(`${r.symbol}|${r.severity}`, now);
    hits.push(row);
  }

  if (fresh.length && wantEmail) {
    email.skipped = false;
    if (!isEmailConfigured()) {
      email.error = '邮件未配置（EMAIL_*）';
    } else {
      try {
        await sendStablecoinDepegEmail({ ...result, trigger: 'auto' });
        email.sent = true;
      } catch (e) {
        email.error = String(e.message || e);
      }
    }
  }

  try {
    saveStablecoinConfig({});
    // lastRun 写在 news/dd 之外，用独立字段不污染 coins — 直接写 settings 通过 saveStablecoinConfig 无 lastRun
  } catch { /* ignore */ }

  return {
    summary: result.summary,
    depegged: depegged.length,
    freshHits: hits.length,
    hits,
    email,
    result,
  };
}

export function startStablecoinAutoMonitor() {
  const cfg = getStablecoinConfig({ coins: DEFAULT_COINS, threshold: DEFAULT_THRESHOLD });
  if (!cfg.autoScan) return false;
  const ms = Math.max(60, cfg.intervalSec || 300) * 1000;
  clearTimer('stablecoin');
  running.stablecoin = true;
  timers.stablecoin = setInterval(() => {
    if (busy.stablecoin) return;
    busy.stablecoin = true;
    checkStablecoinOnce()
      .then((r) => {
        if (r.freshHits) {
          console.log(`[Alerts/sc] auto hits=${r.freshHits} email=${r.email.sent ? 'yes' : 'no'}`);
        }
      })
      .catch((e) => console.error('[Alerts/sc]', e.message || e))
      .finally(() => { busy.stablecoin = false; });
  }, ms);
  setTimeout(() => {
    if (!running.stablecoin) return;
    if (busy.stablecoin) return;
    busy.stablecoin = true;
    checkStablecoinOnce()
      .catch(() => {})
      .finally(() => { busy.stablecoin = false; });
  }, 3000);
  console.log(`[Alerts/sc] auto-scan started interval=${ms / 1000}s`);
  return true;
}

export function stopStablecoinAutoMonitor() {
  clearTimer('stablecoin');
  return false;
}

// ---------- 回撤：仓位收益回撤（需交易所 API Key） ----------
/**
 * 口径：仓位浮盈峰值 → 当前浮盈
 * 例：峰值盈利 1000U，现在 700U → 回撤 (1000-700)/1000 = 30%
 * 仅当峰值为正时才计算收益回撤；亏损加深也会触发（峰值 100 → 现在 -50 = 150%）
 */
export function posKey(p) {
  return `${p.exchange}|${p.symbol}|${p.posSide || 'long'}`;
}

export function pnlDrawdownPct(peakPnl, currentPnl) {
  const peak = Number(peakPnl);
  const cur = Number(currentPnl);
  if (!(peak > 0)) return 0;
  return ((peak - cur) / peak) * 100;
}

export async function checkDrawdownOnce() {
  const cfg = getDrawdownConfig();

  if (!hasExchangeCredentials()) {
    const msg = '未配置交易所 API Key：请到「设置」添加 OKX（含 Passphrase）或 Binance 密钥，权限只需读取';
    saveDrawdownConfig({
      lastRunAt: new Date().toISOString(),
      lastError: msg,
      lastHits: 0,
    });
    return { ok: false, error: 'no_api_key', message: msg };
  }

  const live = await fetchAllOpenPositions();
  if (live.errors?.length && !live.positions.length) {
    const msg = '拉取持仓失败: ' + live.errors.join('；');
    saveDrawdownConfig({ lastRunAt: new Date().toISOString(), lastError: msg, lastHits: 0 });
    return { ok: false, error: 'fetch_failed', message: msg, errors: live.errors };
  }

  const positions = live.positions || [];
  const peaks = { ...(cfg.positionPeaks || {}) };
  const openKeys = new Set();
  const details = [];
  const hits = [];
  let totalPnl = 0;
  let worst = null;

  for (const p of positions) {
    const key = posKey(p);
    openKeys.add(key);
    const upl = Number(p.upl) || 0;
    totalPnl += upl;

    // 记录收益峰值：只在浮盈为正时抬高峰值（与「收益回撤」口径一致）
    if (upl > (Number(peaks[key]) || 0)) peaks[key] = upl;
    const peakPnl = Number(peaks[key]) || 0;
    const dd = pnlDrawdownPct(peakPnl, upl);
    const row = {
      key,
      exchange: p.exchange,
      symbol: p.symbol,
      posSide: p.posSide,
      upl,
      peakPnl,
      drawdownPct: dd,
      lever: p.lever,
      avgPx: p.avgPx,
      markPx: p.markPx,
    };
    details.push(row);
    if (peakPnl > 0 && dd > 0 && (!worst || dd > worst.drawdownPct)) worst = row;
  }

  // 清理已平仓仓位的峰值
  for (const k of Object.keys(peaks)) {
    if (!openKeys.has(k)) delete peaks[k];
  }

  // 总浮盈峰值（可选 mode=total）
  let peakTotal = Number(cfg.peakTotalPnl) || 0;
  if (totalPnl > peakTotal) peakTotal = totalPnl;
  const totalDd = pnlDrawdownPct(peakTotal, totalPnl);

  const thr = cfg.threshold;
  const mode = cfg.mode === 'total' ? 'total' : 'position';
  let shouldAlert = false;
  let alertRow = null;
  let alertDd = 0;
  let alertPeak = 0;
  let alertCur = 0;
  let alertSymbol = '';

  if (mode === 'total') {
    alertDd = totalDd;
    shouldAlert = peakTotal > 0 && totalDd >= thr;
    alertPeak = peakTotal;
    alertCur = totalPnl;
    alertSymbol = 'ALL_POSITIONS';
  } else if (worst) {
    alertDd = worst.drawdownPct;
    shouldAlert = worst.peakPnl > 0 && worst.drawdownPct >= thr;
    alertPeak = worst.peakPnl;
    alertCur = worst.upl;
    alertSymbol = `${worst.exchange}:${worst.symbol}`;
  }

  // 收益明显恢复后解锁，下次再跌可再报
  if (!shouldAlert && cfg.alerted && alertDd < thr * 0.5) {
    saveDrawdownConfig({ alerted: false });
  }

  let hit = null;
  let email = { sent: false, error: null, skipped: true };
  if (shouldAlert && !cfg.alerted) {
    const message =
      mode === 'total'
        ? `仓位总收益回撤 ${alertDd.toFixed(2)}%（浮盈 ${alertCur.toFixed(2)}U / 峰值 ${alertPeak.toFixed(2)}U）≥ 阈值 ${thr}%`
        : `${alertSymbol} 仓位收益回撤 ${alertDd.toFixed(2)}%（浮盈 ${alertCur.toFixed(2)}U / 峰值 ${alertPeak.toFixed(2)}U）≥ 阈值 ${thr}%`;
    hit = insertAlertLog({
      alert_type: 'drawdown',
      symbol: alertSymbol,
      exchange: worst?.exchange || 'multi',
      timeframe: worst?.posSide || '',
      message,
      threshold_pct: thr,
      actual_pct: Number(alertDd.toFixed(4)),
      price: alertCur,
      notified: 0,
    });
    if (cfg.emailNotify) {
      email.skipped = false;
      if (!isEmailConfigured()) {
        email.error = '邮件未配置（EMAIL_*）';
      } else {
        try {
          await sendMail({
            subject: `【仓位回撤】${alertSymbol} ${alertDd.toFixed(2)}% ≥ ${thr}%`,
            text: renderDrawdownEmailText({
              equity: alertCur,
              peak: alertPeak,
              drawdownPct: alertDd,
              threshold: thr,
              symbol: alertSymbol,
              details,
              totalPnl,
              peakTotal,
            }),
            html: renderDrawdownEmailHtml({
              equity: alertCur,
              peak: alertPeak,
              drawdownPct: alertDd,
              threshold: thr,
              symbol: alertSymbol,
              details,
              totalPnl,
              peakTotal,
            }),
          });
          email.sent = true;
        } catch (e) {
          email.error = String(e.message || e);
        }
      }
    }
    saveDrawdownConfig({ alerted: true, lastAlertAt: new Date().toISOString() });
  }

  saveDrawdownConfig({
    positionPeaks: peaks,
    peakTotalPnl: peakTotal,
    peak: alertPeak || peakTotal,
    lastEquity: alertCur || totalPnl,
    lastDrawdownPct: Number((mode === 'total' ? totalDd : (worst?.drawdownPct || 0)).toFixed(4)),
    lastRunAt: new Date().toISOString(),
    lastError: live.errors?.length ? live.errors.join('；') : null,
    lastHits: hit ? 1 : 0,
    mode,
  });

  return {
    ok: true,
    mode,
    threshold: thr,
    positions: details,
    totalPnl,
    peakTotalPnl: peakTotal,
    totalDrawdownPct: totalDd,
    worst,
    fetchErrors: live.errors || [],
    configured: live.configured,
    balances: live.balances,
    hit,
    email,
  };
}

export function startDrawdownMonitor() {
  const cfg = getDrawdownConfig();
  if (!cfg.enabled) return false;
  const ms = Math.max(15, cfg.intervalSec || 60) * 1000;
  clearTimer('drawdown');
  running.drawdown = true;
  timers.drawdown = setInterval(() => {
    if (busy.drawdown) return;
    busy.drawdown = true;
    checkDrawdownOnce()
      .then((r) => {
        if (r.hit) console.log(`[Alerts/dd] hit ${r.worst?.symbol || 'total'} ${r.hit.actual_pct}%`);
      })
      .catch((e) => console.error('[Alerts/dd]', e.message || e))
      .finally(() => { busy.drawdown = false; });
  }, ms);
  setTimeout(() => {
    if (!running.drawdown || busy.drawdown) return;
    busy.drawdown = true;
    checkDrawdownOnce().catch(() => {}).finally(() => { busy.drawdown = false; });
  }, 4000);
  console.log(`[Alerts/dd] position-PnL monitor started interval=${ms / 1000}s`);
  return true;
}

export function stopDrawdownMonitor() {
  clearTimer('drawdown');
  return false;
}

// ---------- 消息面 ----------
const NEWS_SOURCES = [
  {
    name: 'okx-ann',
    async fetch() {
      const d = await proxyJson('https://www.okx.com/api/v5/support/announcements?annType=1&limit=20', {}, 12000);
      return (d?.data || []).map((x) => ({
        id: String(x.announcementId || x.title || ''),
        title: String(x.title || ''),
        body: String(x.description || x.body || ''),
        source: 'OKX',
      }));
    },
  },
  {
    name: 'cointelegraph-rss',
    async fetch() {
      const res = await proxyFetchText('https://cointelegraph.com/rss', 12000);
      const items = [];
      const re = /<item[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>[\s\S]*?<\/item>/gi;
      let m;
      while ((m = re.exec(res)) && items.length < 25) {
        const title = m[1].replace(/<[^>]+>/g, '').trim();
        if (title) items.push({ id: title, title, body: '', source: 'Cointelegraph' });
      }
      return items;
    },
  },
  {
    name: 'binance-ann',
    async fetch() {
      const d = await proxyJson(
        'https://www.binance.com/bapi/composite/v1/public/cms/article/list/query?type=1&catalogId=48&pageNo=1&pageSize=20',
        {},
        12000
      );
      const list = d?.data?.catalogs?.[0]?.articles || d?.data?.articles || [];
      return list.map((x) => ({
        id: String(x.id || x.code || x.title || ''),
        title: String(x.title || ''),
        body: '',
        source: 'Binance',
      }));
    },
  },
];

async function proxyFetchText(url, timeoutMs = 12000) {
  const { proxyFetch } = await import('./httpClient.js');
  const res = await proxyFetch(url, {}, timeoutMs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchNewsItems() {
  const errors = [];
  for (const src of NEWS_SOURCES) {
    try {
      const items = await src.fetch();
      if (items?.length) return { items, source: src.name };
    } catch (e) {
      errors.push(`${src.name}: ${e.message || e}`);
    }
  }
  throw new Error(errors.join(' | ') || 'no news source');
}

const RULES = [
  { cat: 'regulation', w: 28, re: /\bSEC\b|lawsuit|sue[sd]?|ban(ned)?|regulat|enforcement|subpoena|charge[sd]?|ETF (reject|delay)/i },
  { cat: 'regulation', w: 22, re: /监管|起诉|禁止|合规|罚款|违规/ },
  { cat: 'exchange', w: 32, re: /hack(ed|s)?|exploit|drain|withdraw.*(suspend|halt)|bankrupt|insolven|outage|freeze|rug ?pull/i },
  { cat: 'exchange', w: 28, re: /黑客|被盗|暂停提现|破产|跑路|冻结|清退/ },
  { cat: 'macro', w: 22, re: /\bCPI\b|\bFOMC\b|rate (hike|cut)|inflation|recession|war|crisis|default/i },
  { cat: 'macro', w: 18, re: /加息|降息|通胀|衰退|战争|危机|违约/ },
];

export function scoreNewsItem(item, cats) {
  const text = `${item.title || ''} ${item.body || item.description || ''}`;
  let score = 0;
  const tags = new Set();
  for (const r of RULES) {
    if (!cats[r.cat]) continue;
    if (r.re.test(text)) {
      score += r.w;
      tags.add(r.cat);
    }
  }
  return { score: Math.min(100, score), tags: [...tags] };
}

async function aiScoreNews(titles) {
  const base = (process.env.AI_API_BASE_URL || '').trim();
  const key = (process.env.AI_API_KEY || '').trim();
  if (!base || !key) return null;
  const model = process.env.AI_MODEL || 'deepeploy-chat';
  try {
    const res = await proxyJson(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '你是加密市场风控助手。根据标题评估整体新闻风险 0-100，只返回 JSON：{"score":number,"reason":string}',
          },
          { role: 'user', content: titles.slice(0, 8).map((t, i) => `${i + 1}. ${t}`).join('\n') },
        ],
        temperature: 0.2,
      }),
    }, 20000);
    const content = res?.choices?.[0]?.message?.content || '';
    const m = content.match(/"score"\s*:\s*(\d+(?:\.\d+)?)/);
    if (m) return { score: Math.min(100, Number(m[1])), reason: content.slice(0, 200) };
  } catch (e) {
    console.warn('[Alerts/news] AI score failed:', e.message || e);
  }
  return null;
}

export async function checkNewsOnce() {
  const cfg = getNewsConfig();
  let items = [];
  let sourceName = '';
  try {
    const r = await fetchNewsItems();
    items = r.items;
    sourceName = r.source;
  } catch (e) {
    saveNewsConfig({
      lastRunAt: new Date().toISOString(),
      lastError: '新闻源拉取失败: ' + (e.message || e),
      lastHits: 0,
    });
    return { ok: false, error: e.message || String(e) };
  }

  const scored = items
    .map((it) => {
      const s = scoreNewsItem(it, cfg.cats);
      return {
        id: String(it.id || it.title || ''),
        title: String(it.title || '').slice(0, 160),
        source: String(it.source || sourceName || '').slice(0, 40),
        categories: s.tags,
        score: s.score,
      };
    })
    .filter((x) => x.score >= cfg.risk && x.title);

  const ai = scored.length ? await aiScoreNews(scored.map((s) => s.title)) : null;
  const maxRule = scored.length ? Math.max(...scored.map((s) => s.score)) : 0;
  const maxRisk = ai ? Math.max(maxRule, ai.score) : maxRule;

  const fresh = scored.filter((s) => {
    if (newsSeen.has(s.id) || newsSeen.has(s.title)) return false;
    newsSeen.add(s.id);
    newsSeen.add(s.title);
    return true;
  });

  let hit = null;
  let email = { sent: false, error: null, skipped: true };
  if (fresh.length) {
    const top = fresh[0];
    const message = `消息面风险 ${maxRisk} ≥ ${cfg.risk} · ${top.title}${fresh.length > 1 ? ` 等 ${fresh.length} 条` : ''}${ai ? ` · AI ${ai.score}` : ''}`;
    hit = insertAlertLog({
      alert_type: 'news',
      symbol: (top.categories || []).join(',') || 'CRYPTO',
      exchange: top.source || 'news',
      timeframe: '',
      message,
      threshold_pct: cfg.risk,
      actual_pct: maxRisk,
      price: null,
      notified: 0,
    });
    if (cfg.emailNotify) {
      email.skipped = false;
      if (!isEmailConfigured()) {
        email.error = '邮件未配置（EMAIL_*）';
      } else {
        try {
          await sendMail({
            subject: `【消息面告警】风险 ${maxRisk} · ${top.title.slice(0, 40)}`,
            text: renderNewsAlertEmailText({ items: fresh, maxRisk, threshold: cfg.risk, ai }),
            html: renderNewsAlertEmailHtml({ items: fresh, maxRisk, threshold: cfg.risk, ai }),
          });
          email.sent = true;
        } catch (e) {
          email.error = String(e.message || e);
        }
      }
    }
  }

  saveNewsConfig({
    lastRunAt: new Date().toISOString(),
    lastError: null,
    lastHits: fresh.length,
    lastMaxRisk: maxRisk,
    lastTitles: fresh.slice(0, 8).map((x) => x.title),
  });

  return { ok: true, scanned: items.length, hits: fresh.length, maxRisk, ai, hit, email, items: fresh, source: sourceName };
}

export function startNewsMonitor() {
  const cfg = getNewsConfig();
  if (!cfg.enabled) return false;
  const ms = Math.max(60, cfg.intervalSec || 300) * 1000;
  clearTimer('news');
  running.news = true;
  timers.news = setInterval(() => {
    if (busy.news) return;
    busy.news = true;
    checkNewsOnce()
      .then((r) => {
        if (r.hits) console.log(`[Alerts/news] hits=${r.hits} risk=${r.maxRisk}`);
      })
      .catch((e) => console.error('[Alerts/news]', e.message || e))
      .finally(() => { busy.news = false; });
  }, ms);
  setTimeout(() => {
    if (!running.news || busy.news) return;
    busy.news = true;
    checkNewsOnce().catch(() => {}).finally(() => { busy.news = false; });
  }, 5000);
  console.log(`[Alerts/news] started interval=${ms / 1000}s`);
  return true;
}

export function stopNewsMonitor() {
  clearTimer('news');
  return false;
}

// ---------- 编排 ----------
export function syncAlertMonitorsWithConfig() {
  const sc = getStablecoinConfig({ coins: DEFAULT_COINS, threshold: DEFAULT_THRESHOLD });
  const dd = getDrawdownConfig();
  const news = getNewsConfig();
  if (sc.autoScan) startStablecoinAutoMonitor();
  else stopStablecoinAutoMonitor();
  if (dd.enabled) startDrawdownMonitor();
  else stopDrawdownMonitor();
  if (news.enabled) startNewsMonitor();
  else stopNewsMonitor();
  return getAlertsRuntimeStatus();
}

export function getAlertsRuntimeStatus() {
  const sc = getStablecoinConfig({ coins: DEFAULT_COINS, threshold: DEFAULT_THRESHOLD });
  const dd = getDrawdownConfig();
  const news = getNewsConfig();
  return {
    emailConfigured: isEmailConfigured(),
    stablecoin: {
      running: running.stablecoin,
      autoScan: sc.autoScan,
      intervalSec: sc.intervalSec,
      emailNotify: sc.emailNotify,
      coins: sc.coins?.length || 0,
      threshold: sc.threshold,
    },
    drawdown: {
      running: running.drawdown,
      enabled: dd.enabled,
      intervalSec: dd.intervalSec,
      threshold: dd.threshold,
      emailNotify: dd.emailNotify,
      mode: dd.mode || 'position',
      peak: dd.peak,
      lastEquity: dd.lastEquity,
      lastDrawdownPct: dd.lastDrawdownPct,
      lastRunAt: dd.lastRunAt,
      lastError: dd.lastError,
      alerted: dd.alerted,
      peakTotalPnl: dd.peakTotalPnl,
      hasApiKeys: hasExchangeCredentials(),
      exchanges: credentialSummary(),
      positionPeakCount: Object.keys(dd.positionPeaks || {}).length,
    },
    news: {
      running: running.news,
      enabled: news.enabled,
      intervalSec: news.intervalSec,
      risk: news.risk,
      emailNotify: news.emailNotify,
      cats: news.cats,
      lastRunAt: news.lastRunAt,
      lastError: news.lastError,
      lastHits: news.lastHits,
      lastMaxRisk: news.lastMaxRisk,
      lastTitles: news.lastTitles,
      aiConfigured: Boolean((process.env.AI_API_BASE_URL || '').trim() && (process.env.AI_API_KEY || '').trim()),
    },
  };
}

export function autoStartAlertMonitorsIfArmed() {
  try {
    return syncAlertMonitorsWithConfig();
  } catch (e) {
    console.error('[Alerts] auto-start failed:', e.message || e);
    return null;
  }
}

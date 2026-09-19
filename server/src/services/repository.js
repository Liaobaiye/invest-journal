import { getDb, nextId, now, saveDb } from '../db/store.js';

/** JSON helpers matching original API shapes */
export function parseMaybeJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}

export function listPosts({ page = 1, limit = 10, tag = '', includeDrafts = false } = {}) {
  const db = getDb();
  let posts = db.posts.slice();
  if (!includeDrafts) posts = posts.filter((p) => p.is_published === 1);
  if (tag) posts = posts.filter((p) => (p.tags || []).includes(tag) || JSON.stringify(p.tags || []).includes(tag));
  posts.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total = posts.length;
  const start = (page - 1) * limit;
  const slice = posts.slice(start, start + limit);
  // Original returned tags/trade_data as JSON strings in list
  return {
    posts: slice.map((p) => ({
      ...p,
      tags: JSON.stringify(p.tags || []),
      trade_data: JSON.stringify(p.trade_data || {}),
      content: undefined,
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export function getPost(id) {
  const db = getDb();
  return db.posts.find((p) => p.id === Number(id)) || null;
}

export function createPost(body) {
  const db = getDb();
  const post = {
    id: nextId('posts'),
    title: body.title,
    content: body.content,
    summary: body.summary || '',
    tags: Array.isArray(body.tags) ? body.tags : parseMaybeJson(body.tags, []),
    trade_data: body.trade_data && typeof body.trade_data === 'object' ? body.trade_data : parseMaybeJson(body.trade_data, {}),
    is_published: body.is_published === 0 ? 0 : 1,
    created_at: now(),
    updated_at: now(),
  };
  db.posts.push(post);
  saveDb();
  return post;
}

export function updatePost(id, body) {
  const db = getDb();
  const post = db.posts.find((p) => p.id === Number(id));
  if (!post) return null;
  if (body.title != null) post.title = body.title;
  if (body.content != null) post.content = body.content;
  if (body.summary != null) post.summary = body.summary;
  if (body.tags != null) post.tags = Array.isArray(body.tags) ? body.tags : parseMaybeJson(body.tags, post.tags);
  if (body.trade_data != null) {
    post.trade_data = typeof body.trade_data === 'object' ? body.trade_data : parseMaybeJson(body.trade_data, post.trade_data);
  }
  if (body.is_published != null) post.is_published = body.is_published ? 1 : 0;
  post.updated_at = now();
  saveDb();
  return post;
}

export function deletePost(id) {
  const db = getDb();
  const i = db.posts.findIndex((p) => p.id === Number(id));
  if (i < 0) return false;
  db.posts.splice(i, 1);
  db.comments = db.comments.filter((c) => c.post_id !== Number(id));
  saveDb();
  return true;
}

export function listComments(postId) {
  const db = getDb();
  return db.comments
    .filter((c) => c.post_id === Number(postId))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

export function createComment(postId, body) {
  const db = getDb();
  const post = getPost(postId);
  if (!post || post.is_published !== 1) return null;
  const c = {
    id: nextId('comments'),
    post_id: Number(postId),
    author_name: body.author_name,
    content: body.content,
    is_ai: body.is_ai ? 1 : 0,
    parent_id: body.parent_id || null,
    created_at: now(),
  };
  db.comments.push(c);
  saveDb();
  return c;
}

export function deleteComment(id) {
  const db = getDb();
  const i = db.comments.findIndex((c) => c.id === Number(id));
  if (i < 0) return false;
  db.comments.splice(i, 1);
  // remove children
  db.comments = db.comments.filter((c) => c.parent_id !== Number(id));
  saveDb();
  return true;
}

export function stats() {
  const db = getDb();
  return {
    posts: db.posts.filter((p) => p.is_published === 1).length,
    comments: db.comments.length,
  };
}

export function getSettings() {
  return { ...getDb().settings };
}

export function putSite(body) {
  const db = getDb();
  const allowed = ['site_title', 'site_description'];
  let changed = false;
  for (const k of allowed) {
    if (body[k] != null) {
      db.settings[k] = String(body[k]).trim().slice(0, 200);
      changed = true;
    }
  }
  if (changed) saveDb();
  return getSettings();
}

export function listExchangeConfigs() {
  return getDb().exchange_config.map(({ api_key_encrypted, secret_key_encrypted, passphrase_encrypted, ...rest }) => rest);
}

/** 服务端内部使用：读启用中的交易所密钥（勿经 API 外泄） */
export function listExchangeCredentials() {
  return getDb().exchange_config
    .filter((x) => x.is_active !== 0)
    .map((x) => ({
      exchange: String(x.exchange || '').toLowerCase(),
      apiKey: x.api_key_encrypted || '',
      secretKey: x.secret_key_encrypted || '',
      passphrase: x.passphrase_encrypted || '',
      label: x.label || '',
    }))
    .filter((x) => x.exchange && x.apiKey && x.secretKey);
}

export function getExchangeCredentials(exchange) {
  return listExchangeCredentials().find((x) => x.exchange === String(exchange || '').toLowerCase()) || null;
}

export function upsertExchange(body) {
  const db = getDb();
  if (!body.exchange || !body.api_key || !body.secret_key) {
    throw Object.assign(new Error('exchange, api_key, secret_key required'), { status: 400 });
  }
  const existing = db.exchange_config.find((x) => x.exchange === body.exchange);
  if (existing) {
    existing.api_key_encrypted = body.api_key;
    existing.secret_key_encrypted = body.secret_key;
    existing.passphrase_encrypted = body.passphrase || '';
    existing.label = body.label || existing.label || '';
    saveDb();
    return { id: existing.id, message: 'Updated', created: false };
  }
  const row = {
    id: nextId('exchange_config'),
    exchange: body.exchange,
    api_key_encrypted: body.api_key,
    secret_key_encrypted: body.secret_key,
    passphrase_encrypted: body.passphrase || '',
    label: body.label || '',
    is_active: 1,
    created_at: now(),
  };
  db.exchange_config.push(row);
  saveDb();
  return { id: row.id, message: 'Created', created: true };
}

export function deleteExchange(id) {
  const db = getDb();
  const i = db.exchange_config.findIndex((x) => x.id === Number(id));
  if (i < 0) return false;
  db.exchange_config.splice(i, 1);
  saveDb();
  return true;
}

export function toggleExchange(id) {
  const row = getDb().exchange_config.find((x) => x.id === Number(id));
  if (!row) return null;
  row.is_active = row.is_active ? 0 : 1;
  saveDb();
  return { id: row.id, is_active: !!row.is_active };
}

export function listAlertConfigs() {
  return getDb().alert_configs.map((c) => ({
    ...c,
    timeframes: parseMaybeJson(c.timeframes, ['5m']),
    thresholds: parseMaybeJson(c.thresholds, {}),
  }));
}

export function upsertAlertConfig(body) {
  const db = getDb();
  if (!body.symbol) throw Object.assign(new Error('symbol required'), { status: 400 });
  const type = body.alert_type || 'volatility';
  const exchange = body.exchange || 'okx';
  const existing = db.alert_configs.find(
    (c) => c.alert_type === type && c.exchange === exchange && c.symbol === body.symbol
  );
  const timeframes = body.timeframes || ['5m'];
  const thresholds = body.thresholds || {};
  if (existing) {
    existing.timeframes = timeframes;
    existing.thresholds = thresholds;
    existing.is_enabled = body.is_enabled ? 1 : 0;
    existing.updated_at = now();
    saveDb();
    return { id: existing.id, message: 'Updated', created: false };
  }
  const row = {
    id: nextId('alert_configs'),
    alert_type: type,
    exchange,
    symbol: body.symbol,
    timeframes,
    thresholds,
    is_enabled: body.is_enabled ? 1 : 0,
    created_at: now(),
    updated_at: now(),
  };
  db.alert_configs.push(row);
  saveDb();
  return { id: row.id, message: 'Created', created: true };
}

export function deleteAlertConfig(id) {
  const db = getDb();
  const i = db.alert_configs.findIndex((c) => c.id === Number(id));
  if (i < 0) return false;
  db.alert_configs.splice(i, 1);
  saveDb();
  return true;
}

export function listAlertHistory({ page = 1, limit = 20 } = {}) {
  const db = getDb();
  const all = db.alert_log.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total = all.length;
  const alerts = all.slice((page - 1) * limit, page * limit);
  return { alerts, pagination: { page, limit, total } };
}

export function insertAlertLog(entry) {
  const db = getDb();
  const row = {
    id: nextId('alert_log'),
    alert_type: entry.alert_type || 'volatility',
    symbol: entry.symbol || '',
    exchange: entry.exchange || '',
    timeframe: entry.timeframe || '',
    message: entry.message || '',
    threshold_pct: entry.threshold_pct ?? null,
    actual_pct: entry.actual_pct ?? null,
    price: entry.price ?? null,
    notified: entry.notified ? 1 : 0,
    created_at: now(),
  };
  db.alert_log.push(row);
  // 防止无限增长
  if (db.alert_log.length > 500) db.alert_log = db.alert_log.slice(-500);
  saveDb();
  return row;
}

export function listEnabledAlertConfigs(type = 'volatility') {
  return listAlertConfigs().filter((c) => c.alert_type === type && c.is_enabled);
}

/** 波动监测运行参数 — settings.volatility_monitor */
const VOL_MONITOR_KEY = 'volatility_monitor';
const VOL_MONITOR_DEFAULTS = {
  emailNotify: false,
  intervalSec: 60,
  lastRunAt: null,
  lastError: null,
  lastHits: 0,
};

export function getVolatilityMonitorSettings() {
  const db = getDb();
  const raw = db.settings[VOL_MONITOR_KEY];
  let cfg = VOL_MONITOR_DEFAULTS;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      cfg = { ...VOL_MONITOR_DEFAULTS, ...parsed };
    } catch {
      cfg = { ...VOL_MONITOR_DEFAULTS };
    }
  }
  return {
    emailNotify: cfg.emailNotify === true || cfg.emailNotify === 1,
    intervalSec: Math.max(15, Math.min(600, Number(cfg.intervalSec) || 60)),
    lastRunAt: cfg.lastRunAt || null,
    lastError: cfg.lastError || null,
    lastHits: Number(cfg.lastHits) || 0,
  };
}

export function saveVolatilityMonitorSettings(patch = {}) {
  const db = getDb();
  const prev = getVolatilityMonitorSettings();
  const next = { ...prev };
  if (patch.emailNotify != null) next.emailNotify = !!patch.emailNotify;
  if (patch.intervalSec != null) {
    next.intervalSec = Math.max(15, Math.min(600, Number(patch.intervalSec) || 60));
  }
  if (patch.lastRunAt !== undefined) next.lastRunAt = patch.lastRunAt;
  if (patch.lastError !== undefined) next.lastError = patch.lastError;
  if (patch.lastHits !== undefined) next.lastHits = Number(patch.lastHits) || 0;
  db.settings[VOL_MONITOR_KEY] = next;
  saveDb();
  return next;
}

/** 回撤监测 — settings.drawdown_config */
const DD_KEY = 'drawdown_config';
const DD_DEFAULTS = {
  enabled: false,
  threshold: 30,
  emailNotify: false,
  intervalSec: 60,
  peak: 0,
  lastEquity: 0,
  lastDrawdownPct: 0,
  lastAlertAt: null,
  lastRunAt: null,
  lastError: null,
  lastHits: 0,
  alerted: false,
  /** 仓位收益峰值: { "okx|BTC-USDT|long": 1000, ... } */
  positionPeaks: {},
  /** 总浮盈峰值（全部持仓 upl 之和） */
  peakTotalPnl: 0,
  mode: 'position',
};

export function getDrawdownConfig() {
  const db = getDb();
  const raw = db.settings[DD_KEY];
  let cfg = DD_DEFAULTS;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      cfg = { ...DD_DEFAULTS, ...parsed };
    } catch {
      cfg = { ...DD_DEFAULTS };
    }
  }
  return {
    enabled: cfg.enabled === true || cfg.enabled === 1,
    threshold: Math.max(1, Math.min(95, Number(cfg.threshold) || 30)),
    emailNotify: cfg.emailNotify === true || cfg.emailNotify === 1,
    intervalSec: Math.max(15, Math.min(1800, Number(cfg.intervalSec) || 60)),
    peak: Number(cfg.peak) || 0,
    lastEquity: Number(cfg.lastEquity) || 0,
    lastDrawdownPct: Number(cfg.lastDrawdownPct) || 0,
    lastAlertAt: cfg.lastAlertAt || null,
    lastRunAt: cfg.lastRunAt || null,
    lastError: cfg.lastError || null,
    lastHits: Number(cfg.lastHits) || 0,
    alerted: cfg.alerted === true || cfg.alerted === 1,
    positionPeaks: cfg.positionPeaks && typeof cfg.positionPeaks === 'object' ? { ...cfg.positionPeaks } : {},
    peakTotalPnl: Number(cfg.peakTotalPnl) || 0,
    mode: cfg.mode === 'total' ? 'total' : 'position',
  };
}

export function saveDrawdownConfig(patch = {}) {
  const db = getDb();
  const prev = getDrawdownConfig();
  const next = { ...prev };
  if (patch.enabled != null) next.enabled = !!patch.enabled;
  if (patch.threshold != null) {
    next.threshold = Math.max(1, Math.min(95, Number(patch.threshold) || 30));
  }
  if (patch.emailNotify != null) next.emailNotify = !!patch.emailNotify;
  if (patch.intervalSec != null) {
    next.intervalSec = Math.max(15, Math.min(1800, Number(patch.intervalSec) || 60));
  }
  if (patch.peak !== undefined) next.peak = Number(patch.peak) || 0;
  if (patch.lastEquity !== undefined) next.lastEquity = Number(patch.lastEquity) || 0;
  if (patch.lastDrawdownPct !== undefined) next.lastDrawdownPct = Number(patch.lastDrawdownPct) || 0;
  if (patch.lastAlertAt !== undefined) next.lastAlertAt = patch.lastAlertAt;
  if (patch.lastRunAt !== undefined) next.lastRunAt = patch.lastRunAt;
  if (patch.lastError !== undefined) next.lastError = patch.lastError;
  if (patch.lastHits !== undefined) next.lastHits = Number(patch.lastHits) || 0;
  if (patch.alerted != null) next.alerted = !!patch.alerted;
  if (patch.positionPeaks && typeof patch.positionPeaks === 'object') {
    next.positionPeaks = { ...patch.positionPeaks };
  }
  if (patch.peakTotalPnl !== undefined) next.peakTotalPnl = Number(patch.peakTotalPnl) || 0;
  if (patch.mode === 'position' || patch.mode === 'total') next.mode = patch.mode;
  db.settings[DD_KEY] = next;
  saveDb();
  return next;
}

/** 消息面监测 — settings.news_config */
const NEWS_KEY = 'news_config';
const NEWS_DEFAULTS = {
  enabled: false,
  risk: 60,
  emailNotify: false,
  intervalSec: 300,
  cats: { macro: true, regulation: true, exchange: true },
  lastRunAt: null,
  lastError: null,
  lastHits: 0,
  lastMaxRisk: 0,
  lastTitles: [],
};

export function getNewsConfig() {
  const db = getDb();
  const raw = db.settings[NEWS_KEY];
  let cfg = NEWS_DEFAULTS;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      cfg = { ...NEWS_DEFAULTS, ...parsed, cats: { ...NEWS_DEFAULTS.cats, ...(parsed.cats || {}) } };
    } catch {
      cfg = { ...NEWS_DEFAULTS };
    }
  }
  return {
    enabled: cfg.enabled === true || cfg.enabled === 1,
    risk: Math.max(0, Math.min(100, Number(cfg.risk) || 60)),
    emailNotify: cfg.emailNotify === true || cfg.emailNotify === 1,
    intervalSec: Math.max(60, Math.min(3600, Number(cfg.intervalSec) || 300)),
    cats: {
      macro: cfg.cats?.macro !== false,
      regulation: cfg.cats?.regulation !== false,
      exchange: cfg.cats?.exchange !== false,
    },
    lastRunAt: cfg.lastRunAt || null,
    lastError: cfg.lastError || null,
    lastHits: Number(cfg.lastHits) || 0,
    lastMaxRisk: Number(cfg.lastMaxRisk) || 0,
    lastTitles: Array.isArray(cfg.lastTitles) ? cfg.lastTitles.slice(0, 20) : [],
  };
}

export function saveNewsConfig(patch = {}) {
  const db = getDb();
  const prev = getNewsConfig();
  const next = { ...prev };
  if (patch.enabled != null) next.enabled = !!patch.enabled;
  if (patch.risk != null) next.risk = Math.max(0, Math.min(100, Number(patch.risk) || 60));
  if (patch.emailNotify != null) next.emailNotify = !!patch.emailNotify;
  if (patch.intervalSec != null) {
    next.intervalSec = Math.max(60, Math.min(3600, Number(patch.intervalSec) || 300));
  }
  if (patch.cats && typeof patch.cats === 'object') {
    next.cats = {
      macro: patch.cats.macro !== false && patch.cats.macro !== 0,
      regulation: patch.cats.regulation !== false && patch.cats.regulation !== 0,
      exchange: patch.cats.exchange !== false && patch.cats.exchange !== 0,
    };
  }
  if (patch.lastRunAt !== undefined) next.lastRunAt = patch.lastRunAt;
  if (patch.lastError !== undefined) next.lastError = patch.lastError;
  if (patch.lastHits !== undefined) next.lastHits = Number(patch.lastHits) || 0;
  if (patch.lastMaxRisk !== undefined) next.lastMaxRisk = Number(patch.lastMaxRisk) || 0;
  if (patch.lastTitles !== undefined) {
    next.lastTitles = Array.isArray(patch.lastTitles) ? patch.lastTitles.slice(0, 20) : [];
  }
  db.settings[NEWS_KEY] = next;
  saveDb();
  return next;
}

export function getPortfolioOverview({ page = 1, limit = 5 } = {}) {
  const db = getDb();
  const open = db.position_records.filter((p) => p.status === 'open');
  const closedAll = db.position_records
    .filter((p) => p.status === 'closed')
    .sort((a, b) => String(a.close_time || a.open_time).localeCompare(String(b.close_time || b.open_time)));
  const closed = closedAll.slice(-limit);
  const totalEquity = Number(db.settings.last_balance_okx || 0) + Number(db.settings.last_balance_binance || 0);
  const unrealizedPnl = open.reduce((s, p) => s + (Number(p.upl) || 0), 0);
  const curve = [];
  let cum = 0;
  for (const p of closedAll) {
    cum += Number(p.pnl) || 0;
    const d = formatPosDate(p.close_time || p.open_time);
    curve.push({ date: d, value: Math.round(cum * 100) / 100 });
  }
  return {
    totalEquity,
    unrealizedPnl,
    unrealizedPnlRatio: totalEquity ? unrealizedPnl / totalEquity : 0,
    dailyPnl: unrealizedPnl,
    dailyPnlRatio: totalEquity ? unrealizedPnl / totalEquity : 0,
    currentPositions: open.map(serializePos),
    historizedPositions: closed.map(serializePos),
    pnlCurve: curve,
    historyPagination: { page, limit, total: closedAll.length },
  };
}

function serializePos(p) {
  return {
    ...p,
    operations: parseMaybeJson(p.operations, []),
  };
}

function formatPosDate(ts) {
  const n = Number(ts);
  if (!n) return String(ts || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  return new Date(n).toISOString().slice(0, 10);
}

/** 稳定币监控配置 — 存 settings.stablecoin_config */
const STABLECOIN_KEY = 'stablecoin_config';

export function getStablecoinConfig(defaults) {
  const db = getDb();
  const raw = db.settings[STABLECOIN_KEY];
  let cfg = defaults;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      cfg = { ...defaults, ...parsed };
    } catch {
      cfg = { ...defaults };
    }
  }
  const coins = (cfg.coins || defaults.coins)
    .map((c) => String(c || '').trim().toUpperCase())
    .filter(Boolean);
  return {
    coins: [...new Set(coins)],
    threshold: Math.abs(Number(cfg.threshold) || defaults.threshold),
    emailNotify: cfg.emailNotify === true || cfg.emailNotify === 1,
    autoScan: cfg.autoScan === true || cfg.autoScan === 1,
    intervalSec: Math.max(60, Math.min(3600, Number(cfg.intervalSec) || 300)),
  };
}

export function saveStablecoinConfig({ coins, threshold, emailNotify, autoScan, intervalSec }) {
  const db = getDb();
  const prev = getStablecoinConfig({ coins: DEFAULT_SC_COINS_FALLBACK, threshold: 0.005, emailNotify: false });
  const next = {
    coins: coins == null
      ? prev.coins
      : [...new Set((coins || []).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean))],
    threshold: threshold == null ? prev.threshold : Math.abs(Number(threshold) || 0.005),
    emailNotify: emailNotify == null ? prev.emailNotify : !!emailNotify,
    autoScan: autoScan == null ? prev.autoScan : !!autoScan,
    intervalSec: Math.max(60, Math.min(3600, Number(intervalSec) || prev.intervalSec || 300)),
  };
  db.settings[STABLECOIN_KEY] = next;
  saveDb();
  return next;
}

const DEFAULT_SC_COINS_FALLBACK = ['USDT', 'USDC', 'DAI', 'PYUSD', 'GUSD', 'USD1', 'BUSD'];

/** 山寨币自动扫描配置 — settings.altcoin_config */
const ALTCOIN_KEY = 'altcoin_config';
const ALTCOIN_DEFAULTS = {
  autoScanEmail: false,
  intervalHours: 4,
  reportTopN: 30,
  lastAutoRunAt: null,
  lastScanParams: null,
};

export function getAltcoinConfig() {
  const db = getDb();
  const raw = db.settings[ALTCOIN_KEY];
  let cfg = ALTCOIN_DEFAULTS;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      cfg = { ...ALTCOIN_DEFAULTS, ...parsed };
    } catch {
      cfg = { ...ALTCOIN_DEFAULTS };
    }
  }
  const lastScanParams = cfg.lastScanParams && typeof cfg.lastScanParams === 'object'
    ? cfg.lastScanParams
    : null;
  return {
    autoScanEmail: cfg.autoScanEmail === true || cfg.autoScanEmail === 1,
    intervalHours: Math.max(1, Number(cfg.intervalHours) || 4),
    reportTopN: Math.max(5, Math.min(50, Number(cfg.reportTopN) || 30)),
    lastAutoRunAt: cfg.lastAutoRunAt || null,
    lastScanParams,
  };
}

export function saveAltcoinConfig(patch = {}) {
  const db = getDb();
  const prev = getAltcoinConfig();
  const next = { ...prev };
  if (patch.autoScanEmail != null) next.autoScanEmail = !!patch.autoScanEmail;
  if (patch.intervalHours != null) {
    next.intervalHours = Math.max(1, Number(patch.intervalHours) || 4);
  }
  if (patch.reportTopN != null) {
    next.reportTopN = Math.max(5, Math.min(50, Number(patch.reportTopN) || 30));
  }
  if (patch.lastAutoRunAt !== undefined) next.lastAutoRunAt = patch.lastAutoRunAt;
  if (patch.lastScanParams !== undefined) {
    next.lastScanParams = patch.lastScanParams && typeof patch.lastScanParams === 'object'
      ? { ...patch.lastScanParams }
      : null;
  }
  db.settings[ALTCOIN_KEY] = next;
  saveDb();
  return next;
}

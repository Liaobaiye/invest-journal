import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import './env.js';
import { getDb, loadDb, saveDb, now } from './db/store.js';
import { authenticate, optionalAuthenticate } from './middleware/auth.js';
import {
  signAccess, signRefresh, verifyRefresh, setRefreshCookie, clearRefreshCookie,
} from './utils/jwt.js';
import {
  listPosts, getPost, createPost, updatePost, deletePost,
  listComments, createComment, deleteComment,
  stats, getSettings, putSite,
  listExchangeConfigs, upsertExchange, deleteExchange, toggleExchange,
  listAlertConfigs, upsertAlertConfig, deleteAlertConfig, listAlertHistory,
  getPortfolioOverview,
  getStablecoinConfig, saveStablecoinConfig,
  getVolatilityMonitorSettings, saveVolatilityMonitorSettings,
  getDrawdownConfig, saveDrawdownConfig,
  getNewsConfig, saveNewsConfig,
} from './services/repository.js';
import { getTicker, getCandles, proxyHint } from './services/marketService.js';
import {
  checkCoins, DEFAULT_COINS, DEFAULT_THRESHOLD,
} from './services/stablecoinService.js';
import {
  isEmailConfigured, sendStablecoinDepegEmail, sendTestEmail,
} from './services/mailer.js';
import { PROXY_URL } from './env.js';
import { proxyEnabled } from './services/httpClient.js';
import {
  startScan, getScanStatus, getScanResult, fetchDailyKlines, proxyHint as altcoinHint,
  getAltcoinSettings, updateAltcoinSettings,
} from './services/altcoinService.js';
import { listReports, readReportFile } from './services/altcoinReport.js';
import {
  startVolatilityMonitor,
  stopVolatilityMonitor,
  getVolatilityMonitorStatus,
  checkVolatilityOnce,
} from './services/volatilityMonitor.js';
import {
  getAlertsRuntimeStatus,
  syncAlertMonitorsWithConfig,
  checkStablecoinOnce,
  checkDrawdownOnce,
  checkNewsOnce,
} from './services/alertsMonitor.js';
import fs from 'node:fs';

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60_000, limit: 20 });
app.use('/api', apiLimiter);

// ---- health / stats ----
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/stats', (_req, res) => res.json(stats()));

// ---- auth ----
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = getDb().users.find((u) => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const payload = { userId: user.id, username: user.username };
  setRefreshCookie(res, signRefresh(payload));
  res.json({ accessToken: signAccess(payload), username: user.username });
});

app.post('/api/auth/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const payload = verifyRefresh(token);
    const next = { userId: payload.userId, username: payload.username };
    setRefreshCookie(res, signRefresh(next));
    res.json({ accessToken: signAccess(next), username: payload.username });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

app.get('/api/auth/check', authenticate, (req, res) => {
  res.json({ authenticated: true, username: req.username });
});

app.post('/api/auth/logout', (_req, res) => {
  clearRefreshCookie(res);
  res.json({ message: 'Logged out' });
});

// ---- posts ----
app.get('/api/posts', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  res.json(listPosts({ page, limit, tag: req.query.tag || '' }));
});

app.get('/api/posts/:id', optionalAuthenticate, (req, res) => {
  const post = getPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (post.is_published !== 1 && !req.userId) return res.status(404).json({ error: 'Not found' });
  // match original: tags/trade_data as JSON strings in single get too
  res.json({
    ...post,
    tags: JSON.stringify(post.tags || []),
    trade_data: JSON.stringify(post.trade_data || {}),
  });
});

app.post('/api/posts', authenticate, (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
  const post = createPost(req.body);
  res.status(201).json({
    ...post,
    tags: JSON.stringify(post.tags || []),
    trade_data: JSON.stringify(post.trade_data || {}),
  });
});

app.put('/api/posts/:id', authenticate, (req, res) => {
  const post = updatePost(req.params.id, req.body || {});
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...post,
    tags: JSON.stringify(post.tags || []),
    trade_data: JSON.stringify(post.trade_data || {}),
  });
});

app.delete('/api/posts/:id', authenticate, (req, res) => {
  if (!deletePost(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Post deleted' });
});

app.post('/api/posts/:id/ai-comment', authenticate, (req, res) => {
  const post = getPost(req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  const existing = getDb().comments.find((c) => c.post_id === post.id && c.is_ai);
  if (existing) return res.status(201).json({ id: existing.id, content: existing.content });
  const c = createComment(post.id, {
    author_name: 'AI 审阅员',
    content: '结构完整。建议补充仓位规模与回撤分布，便于后续复盘校准。',
    is_ai: 1,
  });
  res.status(201).json({ id: c.id, content: c.content });
});

// ---- comments ----
app.get('/api/posts/:postId/comments', (req, res) => {
  res.json(listComments(req.params.postId));
});

app.post('/api/posts/:postId/comments', (req, res) => {
  const { author_name, content, parent_id } = req.body || {};
  if (!author_name || !content) return res.status(400).json({ error: 'author_name and content required' });
  const c = createComment(req.params.postId, { author_name, content, parent_id });
  if (!c) return res.status(404).json({ error: 'Post not found' });
  res.status(201).json(c);
});

app.delete('/api/comments/:id', authenticate, (req, res) => {
  if (!deleteComment(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Comment deleted' });
});

// ---- market (OKX / Binance public, via Clash/VPN proxy) ----
app.get('/api/market/proxy', (_req, res) => {
  res.json({
    configured: !!PROXY_URL,
    enabled: proxyEnabled(),
    url: PROXY_URL || null,
    hint: proxyHint(),
  });
});

app.get('/api/market/ticker', async (req, res) => {
  const exchange = req.query.exchange || 'okx';
  const instId = req.query.instId || 'BTC-USDT';
  try {
    res.json(await getTicker(instId, exchange));
  } catch (e) {
    res.status(502).json({
      error: 'Ticker unavailable: ' + e.message,
      hint: proxyEnabled() ? undefined : proxyHint(),
    });
  }
});

app.get('/api/market/candles', async (req, res) => {
  const exchange = req.query.exchange || 'okx';
  const instId = req.query.instId || 'BTC-USDT';
  const bar = req.query.bar || '1D';
  const limit = Math.min(100, Number(req.query.limit) || 40);
  try {
    res.json(await getCandles(instId, bar, limit, exchange));
  } catch (e) {
    res.status(502).json({
      error: 'Candles unavailable: ' + e.message,
      hint: proxyEnabled() ? undefined : proxyHint(),
    });
  }
});

app.get('/api/market/balance', authenticate, (_req, res) => {
  res.status(501).json({ error: 'Exchange balance requires configured API keys. Use Settings + exchange adapters.' });
});

// ---- portfolio ----
app.get('/api/portfolio/overview', authenticate, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  res.json(getPortfolioOverview({ page, limit }));
});

app.post('/api/portfolio/sync', authenticate, (req, res) => {
  // Adapter hook: without live exchange credentials return cooldown-style result
  const overview = getPortfolioOverview({ page: 1, limit: 5 });
  res.json({
    ...overview,
    syncResult: {
      current: overview.currentPositions.length,
      history: overview.historizedPositions.length,
      newCount: 0,
      errors: ['交易所同步适配器未启用：请在 settings 配置密钥并接入 CLI/REST 适配器'],
    },
  });
});

// ---- alerts ----
app.get('/api/alerts/configs', authenticate, (_req, res) => {
  res.json(listAlertConfigs());
});

app.post('/api/alerts/configs', authenticate, (req, res) => {
  try {
    const result = upsertAlertConfig(req.body || {});
    res.status(result.created ? 201 : 200).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/alerts/configs/batch', authenticate, (req, res) => {
  const configs = req.body?.configs || [];
  const results = [];
  try {
    for (const c of configs) results.push(upsertAlertConfig(c));
    res.json({ updated: results.length, results });
  } catch (e) {
    res.status(400).json({ error: e.message, results });
  }
});

app.delete('/api/alerts/configs/:id', authenticate, (req, res) => {
  if (!deleteAlertConfig(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

app.get('/api/alerts/history', authenticate, (req, res) => {
  res.json(listAlertHistory({
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(req.query.limit) || 20)),
  }));
});

app.get('/api/alerts/monitor/status', authenticate, (_req, res) => {
  res.json(getVolatilityMonitorStatus());
});
app.post('/api/alerts/monitor/start', authenticate, (_req, res) => {
  try {
    const r = startVolatilityMonitor();
    res.json({ ...r, status: getVolatilityMonitorStatus() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/alerts/monitor/stop', authenticate, (_req, res) => {
  const r = stopVolatilityMonitor();
  res.json({ ...r, status: getVolatilityMonitorStatus() });
});
app.get('/api/alerts/monitor/settings', authenticate, (_req, res) => {
  res.json(getVolatilityMonitorSettings());
});
app.put('/api/alerts/monitor/settings', authenticate, (req, res) => {
  const saved = saveVolatilityMonitorSettings(req.body || {});
  res.json(saved);
});
app.post('/api/alerts/monitor/check', authenticate, async (_req, res) => {
  try {
    const r = await checkVolatilityOnce();
    res.json(r);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---- alerts runtime: stablecoin auto / drawdown / news ----
app.get('/api/alerts/runtime', authenticate, (_req, res) => {
  res.json(getAlertsRuntimeStatus());
});

app.post('/api/alerts/runtime/sync', authenticate, (_req, res) => {
  try {
    res.json(syncAlertMonitorsWithConfig());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/alerts/drawdown/config', authenticate, (_req, res) => {
  res.json(getDrawdownConfig());
});

app.put('/api/alerts/drawdown/config', authenticate, (req, res) => {
  const saved = saveDrawdownConfig(req.body || {});
  try {
    syncAlertMonitorsWithConfig();
  } catch { /* ignore */ }
  res.json(saved);
});

app.post('/api/alerts/drawdown/check', authenticate, async (_req, res) => {
  try {
    const r = await checkDrawdownOnce();
    if (!r.ok) {
      return res.status(r.error === 'no_api_key' ? 400 : 502).json(r);
    }
    res.json(r);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/alerts/news/config', authenticate, (_req, res) => {
  res.json(getNewsConfig());
});

app.put('/api/alerts/news/config', authenticate, (req, res) => {
  const saved = saveNewsConfig(req.body || {});
  try {
    syncAlertMonitorsWithConfig();
  } catch { /* ignore */ }
  res.json(saved);
});

app.post('/api/alerts/news/check', authenticate, async (_req, res) => {
  try {
    const r = await checkNewsOnce();
    if (!r.ok) return res.status(502).json(r);
    res.json(r);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/alerts/stablecoin/check-auto', authenticate, async (_req, res) => {
  try {
    const r = await checkStablecoinOnce();
    res.json({ ok: true, ...r });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ---- settings ----
app.get('/api/settings/exchange', authenticate, (_req, res) => res.json(listExchangeConfigs()));

app.post('/api/settings/exchange', authenticate, (req, res) => {
  try {
    const r = upsertExchange(req.body || {});
    res.status(r.created ? 201 : 200).json(r);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.delete('/api/settings/exchange/:id', authenticate, (req, res) => {
  if (!deleteExchange(req.params.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

app.patch('/api/settings/exchange/:id/toggle', authenticate, (req, res) => {
  const r = toggleExchange(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

// Fix: only expose site keys (do not leak internal settings)
app.get('/api/settings/site', authenticate, (_req, res) => {
  const s = getSettings();
  res.json({ site_title: s.site_title, site_description: s.site_description });
});

app.put('/api/settings/site', authenticate, (req, res) => {
  if (!req.body || (req.body.site_title == null && req.body.site_description == null)) {
    return res.status(400).json({ error: 'site_title or site_description required' });
  }
  putSite(req.body);
  const s = getSettings();
  res.json({ site_title: s.site_title, site_description: s.site_description });
});

// ---- stablecoin depeg monitor ----
app.get('/api/stablecoins/config', authenticate, (_req, res) => {
  res.json(getStablecoinConfig({ coins: DEFAULT_COINS, threshold: DEFAULT_THRESHOLD }));
});

app.put('/api/stablecoins/config', authenticate, (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.coins)) {
    return res.status(400).json({ error: 'coins must be an array of symbols' });
  }
  const saved = saveStablecoinConfig({
    coins: body.coins,
    threshold: body.threshold,
    emailNotify: body.emailNotify,
    autoScan: body.autoScan,
    intervalSec: body.intervalSec,
  });
  try {
    syncAlertMonitorsWithConfig();
  } catch { /* ignore */ }
  res.json(saved);
});

app.get('/api/stablecoins/check', authenticate, async (req, res) => {
  try {
    const cfg = getStablecoinConfig({ coins: DEFAULT_COINS, threshold: DEFAULT_THRESHOLD });
    const coins = req.query.coins
      ? String(req.query.coins).split(',').map((s) => s.trim()).filter(Boolean)
      : cfg.coins;
    const threshold = req.query.threshold != null
      ? Number(req.query.threshold)
      : cfg.threshold;
    const notify = req.query.notify === '1' || req.query.notify === 'true'
      ? true
      : (req.query.notify === '0' || req.query.notify === 'false' ? false : cfg.emailNotify);
    const result = await checkCoins(coins, threshold);
    let email = { configured: isEmailConfigured(), sent: false, error: null };
    if (notify && result.summary?.depegged > 0 && isEmailConfigured()) {
      try {
        await sendStablecoinDepegEmail(result);
        email.sent = true;
      } catch (e) {
        email.error = e.message;
      }
    }
    res.json({ ...result, email });
  } catch (e) {
    res.status(502).json({
      error: 'Stablecoin check failed: ' + e.message,
      hint: proxyEnabled() ? undefined : proxyHint(),
    });
  }
});

app.post('/api/settings/email/test', authenticate, async (_req, res) => {
  if (!isEmailConfigured()) {
    return res.status(400).json({ error: '邮件未配置：请在 server/.env 设置 EMAIL_USER / EMAIL_AUTH_CODE / EMAIL_TO' });
  }
  try {
    await sendTestEmail();
    res.json({ message: '测试邮件已发送' });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/settings/email/status', authenticate, (_req, res) => {
  res.json({
    configured: isEmailConfigured(),
    user: process.env.EMAIL_USER || null,
    to: process.env.EMAIL_TO || null,
  });
});

// ---- altcoin volume spike scan ----
app.get('/api/altcoin/status', (_req, res) => {
  res.json(getScanStatus());
});

app.get('/api/altcoin/results', (_req, res) => {
  res.json(getScanResult());
});

app.get('/api/altcoin/settings', (_req, res) => {
  res.json(getAltcoinSettings());
});

app.put('/api/altcoin/settings', authenticate, (req, res) => {
  const body = req.body || {};
  const saved = updateAltcoinSettings({
    autoScanEmail: body.autoScanEmail,
    intervalHours: body.intervalHours,
    reportTopN: body.reportTopN,
  });
  res.json(saved);
});

app.get('/api/altcoin/history', (_req, res) => {
  res.json({ items: listReports() });
});

app.get('/api/altcoin/history/:id', (req, res) => {
  const file = readReportFile(req.params.id);
  if (!file) return res.status(404).json({ error: '报告不存在' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  fs.createReadStream(file).pipe(res);
});

app.post('/api/altcoin/scan', authenticate, async (req, res) => {
  try {
    const r = await startScan(req.body || {});
    if (!r.started && r.reason === 'already_running') {
      return res.status(409).json({ error: '扫描进行中', status: r.status });
    }
    res.status(202).json({ message: '扫描已启动', status: r.status });
  } catch (e) {
    res.status(e.status || 502).json({
      error: e.message,
      hint: proxyEnabled() ? undefined : altcoinHint(),
    });
  }
});

app.get('/api/altcoin/klines', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const limit = Math.min(120, Math.max(10, Number(req.query.limit) || 60));
    const candles = await fetchDailyKlines(symbol, limit);
    res.json({ symbol, candles });
  } catch (e) {
    res.status(e.status || 502).json({
      error: e.message,
      hint: proxyEnabled() ? undefined : altcoinHint(),
    });
  }
});

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export function init() {
  loadDb();
  return app;
}

export default app;

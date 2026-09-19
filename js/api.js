import { clearAuth, setAuth } from './store.js';

const BASE = '/api';

/** Demo fallback when backend is unavailable */
const DEMO = {
  posts: [
    {
      id: 1,
      title: 'BTC 市场结构复盘：关键支撑与仓位管理',
      summary: '从日线结构出发，复盘近期 BTC 的突破与回踩，并记录对应的仓位调整逻辑。',
      content: `## 市场背景\n\n近期 BTC 在日线级别完成了一次有效突破，随后回踩前高确认支撑。\n\n## 交易计划\n\n- 突破确认后分批建仓\n- 回撤不超过 8% 不加仓\n- 目标位分批止盈\n\n> 纪律是交易者的护城河。\n`,
      tags: '["BTC","复盘"]',
      trade_data: '{"symbol":"BTC-USDT","entry":68000,"target":72000,"stop":64500}',
      is_published: 1,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 2,
      title: '波动率监控：如何设置合理阈值',
      summary: '不同周期的波动阈值应如何区分，以及冷却时间对误报的影响。',
      content: `## 为什么要区分周期\n\n短周期噪声大，长周期信号更可靠。\n\n## 建议阈值\n\n- 1m: 1%\n- 5m: 3%\n- 1H: 2%\n- 1D: 8%\n`,
      tags: '["监控","策略"]',
      trade_data: '{}',
      is_published: 1,
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: 3,
      title: '双交易所账户统一对账实践',
      summary: 'OKX 与 Binance 持仓口径差异，以及统一视图的构建方式。',
      content: `## 口径差异\n\nOKX 使用 instId / posSide，Binance 使用 symbol / positionSide。\n\n## 对账步骤\n\n1. 拉取当前持仓\n2. 归一化字段\n3. 按交易所分桶后汇总权益\n`,
      tags: '["OKX","Binance","组合"]',
      trade_data: '{}',
      is_published: 1,
      created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
  ],
  comments: {
    1: [
      { id: 1, post_id: 1, author_name: '访客', content: '结构清晰，受教了。', is_ai: 0, parent_id: null, created_at: new Date().toISOString() },
      { id: 2, post_id: 1, author_name: 'AI 审阅员', content: '建议补充回撤比例的历史分布，便于校准止损。', is_ai: 1, parent_id: null, created_at: new Date().toISOString() },
    ],
  },
  positions: [
    {
      id: 1, exchange: 'okx', pos_id: 'okx-1', inst_id: 'BTC-USDT', pos_side: 'long',
      lever: 10, open_avg_px: 68200, close_avg_px: 0, mark_px: 69500, avg_px: 68200,
      max_size: '0.15', pnl: 195, pnl_ratio: 0.019, upl: 195, upl_ratio: 0.019,
      margin: 1023, status: 'open', open_time: String(Date.now() - 3600000), close_time: '',
      operations: '[]',
    },
    {
      id: 2, exchange: 'binance', pos_id: 'bn-1', inst_id: 'ETHUSDT', pos_side: 'short',
      lever: 5, open_avg_px: 3520, close_avg_px: 3480, mark_px: 3480, avg_px: 3520,
      max_size: '1.2', pnl: 48, pnl_ratio: 0.011, upl: 0, upl_ratio: 0,
      margin: 844.8, status: 'closed', open_time: String(Date.now() - 86400000 * 2), close_time: String(Date.now() - 86400000),
      operations: '[{"time":"","action":"open","price":3520,"size":"1.2"},{"time":"","action":"close","price":3480,"size":"1.2"}]',
    },
  ],
  alertConfigs: [
    { id: 1, alert_type: 'volatility', symbol: 'BTC-USDT', exchange: 'okx', timeframes: ['5m'], thresholds: { '5m': 3 }, is_enabled: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
  alertHistory: [
    { id: 1, alert_type: 'volatility', symbol: 'BTC-USDT', exchange: 'okx', timeframe: '5m', threshold_pct: 3, actual_pct: 3.8, price: 69120, message: 'BTC-USDT 5m 波动 3.82% 超过阈值 3%', notified: 1, created_at: new Date().toISOString() },
  ],
  site: { site_title: '投资日志', site_description: '记录投资日常与交易心得' },
  exchanges: [],
};

let demoMode = false;
export function isDemoMode() {
  return demoMode;
}

function token() {
  return localStorage.getItem('accessToken');
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(BASE + path, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${token()}`;
      const retry = await fetch(BASE + path, { ...options, headers, credentials: 'include' });
      return handleJson(retry);
    }
  }
  return handleJson(res);
}

async function handleJson(res) {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = data.error || data.message || msg;
    } catch { /* ignore */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function tryRefresh() {
  try {
    const res = await fetch(BASE + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    setAuth({ user: { username: data.username }, token: data.accessToken });
    return true;
  } catch {
    return false;
  }
}

/** Catch network errors and fall back to demo data */
async function withDemo(path, demoFn, requestFn) {
  try {
    const result = await requestFn();
    if (demoMode) {
      demoMode = false;
      window.dispatchEvent(new CustomEvent('demo-mode', { detail: { demo: false } }));
    }
    return result;
  } catch (e) {
    if (e.status && e.status < 500 && e.status !== 0) throw e;
    // network / 5xx → demo（区分行情外网失败 vs 后端不可达）
    if (!demoMode) {
      demoMode = true;
      const isMarket = /market|stablecoin|ticker|candle|altcoin|klines/i.test(String(path));
      window.dispatchEvent(
        new CustomEvent('demo-mode', {
          detail: { demo: true, source: isMarket ? 'market' : 'backend', error: e.message },
        })
      );
    }
    return demoFn(path, e);
  }
}

export const api = {
  // Auth
  async login(username, password) {
    const data = await request('/auth/login', { method: 'POST', body: { username, password } });
    localStorage.setItem('accessToken', data.accessToken);
    setAuth({ user: { username: data.username }, token: data.accessToken });
    return data;
  },
  async check() {
    try {
      const data = await request('/auth/check');
      setAuth({ user: { username: data.username }, token: token() });
      return data;
    } catch (e) {
      if (e.status === 401) clearAuth();
      return { authenticated: false };
    }
  },
  async logout() {
    try { await request('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearAuth();
  },

  // Stats
  async stats() {
    return withDemo('stats', () => ({ posts: DEMO.posts.length, comments: 2 }), () => request('/stats'));
  },

  // Blog
  async listPosts({ page = 1, limit = 10, tag = '' } = {}) {
    return withDemo('posts', () => {
      let posts = DEMO.posts.filter((p) => p.is_published);
      if (tag) posts = posts.filter((p) => (p.tags || '').includes(tag));
      const total = posts.length;
      const start = (page - 1) * limit;
      return {
        posts: posts.slice(start, start + limit),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      };
    }, () => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (tag) q.set('tag', tag);
      return request(`/posts?${q}`);
    });
  },
  async getPost(id) {
    return withDemo('post', () => {
      const p = DEMO.posts.find((x) => x.id === Number(id));
      if (!p) throw Object.assign(new Error('Post not found'), { status: 404 });
      return p;
    }, () => request(`/posts/${id}`));
  },
  async createPost(data) {
    return request('/posts', { method: 'POST', body: data });
  },
  async updatePost(id, data) {
    return request(`/posts/${id}`, { method: 'PUT', body: data });
  },
  async deletePost(id) {
    return request(`/posts/${id}`, { method: 'DELETE' });
  },
  async aiComment(id) {
    return request(`/posts/${id}/ai-comment`, { method: 'POST' });
  },

  // Comments
  async listComments(postId) {
    return withDemo('comments', () => DEMO.comments[postId] || [], () => request(`/posts/${postId}/comments`));
  },
  async createComment(postId, data) {
    return withDemo('comment', () => ({
      id: Date.now(), post_id: postId, ...data, is_ai: 0, parent_id: data.parent_id || null,
      created_at: new Date().toISOString(),
    }), () => request(`/posts/${postId}/comments`, { method: 'POST', body: data }));
  },
  async deleteComment(id) {
    return request(`/comments/${id}`, { method: 'DELETE' });
  },

  // Market
  async ticker(instId = 'BTC-USDT', exchange = 'okx') {
    return withDemo('ticker', () => ({ last: 69120, open24h: 67800, high24h: 70200, low24h: 67100, vol24h: 12345 }),
      () => request(`/market/ticker?instId=${encodeURIComponent(instId)}&exchange=${exchange}`));
  },
  async candles(instId = 'BTC-USDT', bar = '1D', limit = 40, exchange = 'okx') {
    return withDemo('candles', () => {
      const out = [];
      let px = 66000;
      const now = Date.now();
      for (let i = limit - 1; i >= 0; i--) {
        const open = px;
        const close = open + (Math.random() - 0.48) * 1200;
        const high = Math.max(open, close) + Math.random() * 400;
        const low = Math.min(open, close) - Math.random() * 400;
        out.push([String(now - i * 86400000), String(open), String(high), String(low), String(close), String(Math.random() * 1000)]);
        px = close;
      }
      return out;
    }, () => request(`/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${limit}&exchange=${exchange}`));
  },
  async balance(exchange) {
    return request(`/market/balance?exchange=${exchange}`);
  },

  // Portfolio
  async portfolioOverview(exchange = 'all', page = 1, limit = 5) {
    return withDemo('portfolio', () => {
      const open = DEMO.positions.filter((p) => p.status === 'open');
      const closed = DEMO.positions.filter((p) => p.status === 'closed');
      const curve = closed.map((p, i) => ({ date: new Date(Date.now() - (closed.length - i) * 86400000).toISOString().slice(0, 10), value: p.pnl }));
      return {
        totalEquity: 25000,
        unrealizedPnl: open.reduce((s, p) => s + (p.upl || 0), 0),
        unrealizedPnlRatio: 0.008,
        dailyPnl: open.reduce((s, p) => s + (p.upl || 0), 0),
        dailyPnlRatio: 0.008,
        currentPositions: open,
        historizedPositions: closed,
        pnlCurve: curve,
        historyPagination: { page, limit, total: closed.length },
      };
    }, () => request(`/portfolio/overview?exchange=${exchange}&page=${page}&limit=${limit}`));
  },
  async portfolioSync(exchange = 'all') {
    return request(`/portfolio/sync?exchange=${exchange}`, { method: 'POST' });
  },

  // Alerts
  async listAlertConfigs() {
    return withDemo('alertConfigs', () => DEMO.alertConfigs, () => request('/alerts/configs'));
  },
  async saveAlertConfig(data) {
    return withDemo('saveAlert', () => ({ id: 1, message: 'Saved', created: true }), () => request('/alerts/configs', { method: 'POST', body: data }));
  },
  async saveAlertConfigs(configs) {
    return withDemo('saveAlertBatch', () => ({ updated: configs.length }),
      () => request('/alerts/configs/batch', { method: 'POST', body: { configs } }));
  },
  async deleteAlertConfig(id) {
    return request(`/alerts/configs/${id}`, { method: 'DELETE' });
  },
  async alertHistory({ page = 1, limit = 20 } = {}) {
    return withDemo('alertHistory', () => ({ alerts: DEMO.alertHistory, pagination: { page, limit, total: DEMO.alertHistory.length } }),
      () => request(`/alerts/history?page=${page}&limit=${limit}`));
  },
  async monitorStatus() {
    return withDemo('monitor', () => ({ running: false }), () => request('/alerts/monitor/status'));
  },
  async startMonitor() {
    return request('/alerts/monitor/start', { method: 'POST' });
  },
  async stopMonitor() {
    return request('/alerts/monitor/stop', { method: 'POST' });
  },
  async volatilityMonitorSettings() {
    return request('/alerts/monitor/settings');
  },
  async saveVolatilityMonitorSettings(patch) {
    return request('/alerts/monitor/settings', { method: 'PUT', body: patch });
  },
  async checkVolatilityNow() {
    return request('/alerts/monitor/check', { method: 'POST' });
  },
  async alertsRuntime() {
    return request('/alerts/runtime');
  },
  async syncAlertsRuntime() {
    return request('/alerts/runtime/sync', { method: 'POST' });
  },
  async drawdownConfig() {
    return request('/alerts/drawdown/config');
  },
  async saveDrawdownConfig(patch) {
    return request('/alerts/drawdown/config', { method: 'PUT', body: patch });
  },
  async checkDrawdownNow() {
    return request('/alerts/drawdown/check', { method: 'POST' });
  },
  async newsConfig() {
    return request('/alerts/news/config');
  },
  async saveNewsConfig(patch) {
    return request('/alerts/news/config', { method: 'PUT', body: patch });
  },
  async checkNewsNow() {
    return request('/alerts/news/check', { method: 'POST' });
  },
  async checkStablecoinAutoNow() {
    return request('/alerts/stablecoin/check-auto', { method: 'POST' });
  },

  // Settings
  async listExchanges() {
    return withDemo('exchanges', () => DEMO.exchanges, () => request('/settings/exchange'));
  },
  async addExchange(data) {
    return request('/settings/exchange', { method: 'POST', body: data });
  },
  async deleteExchange(id) {
    return request(`/settings/exchange/${id}`, { method: 'DELETE' });
  },
  async toggleExchange(id) {
    return request(`/settings/exchange/${id}/toggle`, { method: 'PATCH' });
  },
  async getSite() {
    return withDemo('site', () => DEMO.site, () => request('/settings/site'));
  },
  async updateSite(data) {
    return request('/settings/site', { method: 'PUT', body: data });
  },

  // Stablecoin depeg
  async stablecoinConfig() {
    return withDemo('stableCfg', () => ({
      coins: ['USDT', 'USDC', 'DAI', 'PYUSD'],
      threshold: 0.005,
      emailNotify: false,
    }), () => request('/stablecoins/config'));
  },
  async saveStablecoinConfig(data) {
    return request('/stablecoins/config', { method: 'PUT', body: data });
  },
  async checkStablecoins(params = {}) {
    const q = new URLSearchParams();
    if (params.coins) q.set('coins', params.coins);
    if (params.threshold != null) q.set('threshold', String(params.threshold));
    if (params.notify != null) q.set('notify', params.notify ? '1' : '0');
    const qs = q.toString();
    return withDemo('stableCheck', () => {
      const coins = (params.coins ? String(params.coins).split(',') : ['USDT', 'USDC', 'DAI']).map((s) => s.trim().toUpperCase());
      const thr = Number(params.threshold) || 0.005;
      const results = coins.map((symbol, i) => {
        const price = 1 + (i % 2 === 0 ? 0.0002 : -0.0003);
        const deviation = price - 1;
        return {
          symbol, price, deviation, deviation_pct: deviation * 100, deviation_bps: deviation * 10000,
          depegged: Math.abs(deviation) >= thr,
          severity: Math.abs(deviation) >= thr ? 'depeg' : 'ok',
          error: null,
        };
      });
      return {
        peg: 1, threshold: thr, timestamp_utc: new Date().toISOString(), source: 'demo',
        results,
        summary: { total: results.length, ok: results.length, depegged: 0, errors: 0 },
        email: { configured: false, sent: false, error: null },
      };
    }, () => request(`/stablecoins/check${qs ? `?${qs}` : ''}`));
  },
  async emailStatus() {
    return request('/settings/email/status');
  },
  async sendTestEmail() {
    return request('/settings/email/test', { method: 'POST' });
  },

  // Altcoin volume spike scan
  async altcoinStatus() {
    return request('/altcoin/status');
  },
  async altcoinResults() {
    return request('/altcoin/results');
  },
  async startAltcoinScan(params = {}) {
    return request('/altcoin/scan', { method: 'POST', body: params });
  },
  async altcoinKlines(symbol, limit = 60) {
    return request(`/altcoin/klines?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
  },
  async altcoinSettings() {
    return request('/altcoin/settings');
  },
  async saveAltcoinSettings(patch) {
    return request('/altcoin/settings', { method: 'PUT', body: patch });
  },
  async altcoinHistory() {
    return request('/altcoin/history');
  },
};

export default api;

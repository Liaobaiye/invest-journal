import api from '../api.js';
import { icon } from '../utils/icons.js';
import { formatTime, formatNumber, escapeHtml } from '../utils/format.js';
import { applyReveal } from '../utils/motion.js';
import { renderToggle } from '../components/shared.js';
import { isAuthenticated } from '../store.js';

const DEFAULT_TF = { '1m': 1, '5m': 3, '15m': 2, '1H': 2, '4H': 5, '1D': 8 };

export async function AlertsPage(main, ctx = {}) {
  const alive = typeof ctx.alive === 'function' ? ctx.alive : () => true;
  const local = JSON.parse(localStorage.getItem('myweb_alerts') || '{}');
  const state = {
    volEnabled: local.volEnabled ?? false,
    timeframes: local.timeframes || ['5m'],
    thresholds: local.thresholds || { ...DEFAULT_TF },
    coins: local.coins || ['BTC-USDT'],
    exchanges: local.exchanges || ['okx'],
    volEmailNotify: local.volEmailNotify ?? false,
    ddEnabled: local.ddEnabled ?? false,
    ddThreshold: local.ddThreshold ?? 30,
    ddEmailNotify: local.ddEmailNotify ?? false,
    newsEnabled: local.newsEnabled ?? false,
    newsRisk: local.newsRisk ?? 60,
    newsEmailNotify: local.newsEmailNotify ?? false,
    newsCats: local.newsCats || { macro: true, regulation: true, exchange: true },
    scAutoScan: local.scAutoScan ?? false,
  };

  main.innerHTML = `
    <div class="alerts-page">
      <div class="alerts-head">
        <h1>交易提醒</h1>
        <p class="muted">波动 / 回撤 / 消息面 AI / 稳定币脱锚</p>
      </div>
      <div class="alerts-layout">
        <div class="alerts-main">
          ${volCard(state)}
          ${ddCard(state)}
          ${newsCard(state)}
          ${stablecoinCardShell()}
        </div>
        <aside class="alerts-side glass-card">
          <div class="panel-head">
            <span class="panel-icon">${icon('alerts', 16)}</span>
            <span>告警历史</span>
          </div>
          <div id="alert-history"><div class="loading-state"><span class="loading-spinner"></span></div></div>
          <div class="pagination" id="hist-pagination"></div>
        </aside>
      </div>
      <div id="alert-toast"></div>
    </div>
  `;

  applyReveal(main);
  bindVol(main, state);
  bindDd(main, state);
  bindNews(main, state);
  await bindStablecoin(main, alive);
  if (!alive()) return;
  await loadHistory(main, 1);

  if (!isAuthenticated()) {
    main.insertAdjacentHTML('afterbegin',
      `<div class="error-banner">未登录：配置仅保存在本地，登录后可同步到服务端</div>`);
  }
}

function volCard(s) {
  const tfs = Object.keys(DEFAULT_TF);
  return `
    <section class="alert-card glass-card ${s.volEnabled ? 'armed' : ''}" id="card-vol">
      <div class="alert-card-head">
        <div class="alert-icon vol">${icon('trend', 22)}</div>
        <div>
          <h3>波动监控</h3>
          <p class="muted">短周期振幅超过阈值时告警 · 服务端后台检测</p>
        </div>
        ${renderToggle(s.volEnabled, 'tg-vol', '波动监控')}
      </div>
      <div class="alert-body">
        <div class="tf-row">
          ${tfs.map((tf) => `
            <button type="button" class="tag-chip tf-chip ${s.timeframes.includes(tf) ? 'active' : ''}" data-tf="${tf}">${tf}</button>
          `).join('')}
        </div>
        <div class="threshold-row">
          ${tfs.map((tf) => `
            <label class="th-item ${s.timeframes.includes(tf) ? '' : 'dim'}">
              <span>${tf}</span>
              <input type="number" class="form-input th-input" data-th-tf="${tf}" value="${s.thresholds[tf] ?? DEFAULT_TF[tf]}" min="0.1" step="0.1" />
              <span>%</span>
            </label>
          `).join('')}
        </div>
        <div class="exchange-row">
          <span class="muted">交易所</span>
          <button type="button" class="tag-chip ${s.exchanges.includes('okx') ? 'active' : ''}" data-ex="okx">OKX</button>
          <button type="button" class="tag-chip ${s.exchanges.includes('binance') ? 'active' : ''}" data-ex="binance">Binance</button>
        </div>
        <div class="coin-row">
          <span class="muted">币种</span>
          <span id="vol-coins">${s.coins.map((c) => `<span class="tag-chip active">${escapeHtml(c)} <button type="button" class="chip-x" data-rm-coin="${escapeHtml(c)}">×</button></span>`).join('')}</span>
          <input class="form-input coin-add" id="coin-add" placeholder="如 ETH-USDT" />
        </div>
        <div class="vol-actions">
          <label class="inline-field" title="命中阈值时发送 SMTP 邮件（需配置 EMAIL_*）">
            <input type="checkbox" id="vol-email" ${s.volEmailNotify ? 'checked' : ''} />
            <span>波动发邮件</span>
          </label>
          <button type="button" class="btn-primary btn-sm" id="vol-sync">${icon('refresh', 14)} 同步并启动</button>
          <button type="button" class="btn-ghost btn-sm" id="vol-check-now">立即检测</button>
          <span class="muted" id="vol-monitor-meta" style="font-size:0.78rem"></span>
        </div>
      </div>
    </section>
  `;
}

function ddCard(s) {
  return `
    <section class="alert-card glass-card ${s.ddEnabled ? 'armed' : ''}" id="card-dd">
      <div class="alert-card-head">
        <div class="alert-icon dd">${icon('shield', 22)}</div>
        <div>
          <h3>回撤监控</h3>
          <p class="muted">仓位收益回撤 · 峰值浮盈→当前浮盈 · 需交易所 API Key</p>
        </div>
        ${renderToggle(s.ddEnabled, 'tg-dd', '回撤监控')}
      </div>
      <div class="alert-body">
        <label class="inline-field" title="例：峰值盈利1000U → 当前700U = 30% 回撤">
          <span>阈值</span>
          <input type="number" class="form-input" id="dd-threshold" value="${s.ddThreshold ?? 30}" min="1" max="95" />
          <span>%</span>
        </label>
        <div class="vol-actions">
          <label class="inline-field" title="超阈值时发邮件">
            <input type="checkbox" id="dd-email" ${s.ddEmailNotify ? 'checked' : ''} />
            <span>回撤发邮件</span>
          </label>
          <button type="button" class="btn-primary btn-sm" id="dd-sync">${icon('refresh', 14)} 同步并启动</button>
          <button type="button" class="btn-ghost btn-sm" id="dd-check-now">立即检测</button>
        </div>
        <p class="muted" id="dd-monitor-meta" style="font-size:0.78rem;margin-top:8px"></p>
        <p class="muted" style="font-size:0.75rem;margin-top:4px">请在「设置 → 交易所」配置 OKX（Key/Secret/Passphrase）或 Binance，权限只需<strong>只读</strong>。</p>
      </div>
    </section>
  `;
}

function newsCard(s) {
  return `
    <section class="alert-card glass-card ${s.newsEnabled ? 'armed' : ''}" id="card-news">
      <div class="alert-card-head">
        <div class="alert-icon news">${icon('spark', 22)}</div>
        <div>
          <h3>消息面 AI</h3>
          <p class="muted">新闻风险评分 · 规则 + 可选 AI · 超阈值告警</p>
        </div>
        ${renderToggle(s.newsEnabled, 'tg-news', '消息面 AI')}
      </div>
      <div class="alert-body">
        <label class="inline-field">
          <span>风险阈值</span>
          <input type="number" class="form-input" id="news-risk" value="${s.newsRisk}" min="0" max="100" />
        </label>
        <div class="cat-row">
          <label><input type="checkbox" data-cat="macro" ${s.newsCats.macro ? 'checked' : ''}/> 宏观</label>
          <label><input type="checkbox" data-cat="regulation" ${s.newsCats.regulation ? 'checked' : ''}/> 监管</label>
          <label><input type="checkbox" data-cat="exchange" ${s.newsCats.exchange ? 'checked' : ''}/> 交易所</label>
        </div>
        <div class="vol-actions">
          <label class="inline-field">
            <input type="checkbox" id="news-email" ${s.newsEmailNotify ? 'checked' : ''} />
            <span>消息发邮件</span>
          </label>
          <button type="button" class="btn-primary btn-sm" id="news-sync">${icon('refresh', 14)} 同步并启动</button>
          <button type="button" class="btn-ghost btn-sm" id="news-check-now">立即检测</button>
          <span class="muted" id="news-monitor-meta" style="font-size:0.78rem"></span>
        </div>
      </div>
    </section>
  `;
}

function stablecoinCardShell() {
  return `
    <section class="alert-card glass-card" id="card-sc">
      <div class="alert-card-head">
        <div class="alert-icon news">${icon('coins', 22)}</div>
        <div>
          <h3>稳定币脱锚</h3>
          <p class="muted">Coinbase Spot · 可自动扫描 · 脱钩可发邮件</p>
        </div>
      </div>
      <div class="alert-body">
        <div class="sc-inline-toolbar">
          <label class="inline-field">
            <span>阈值</span>
            <input type="number" class="form-input" id="sc-threshold" min="0.0001" max="0.5" step="0.0005" value="0.005" />
            <span class="muted" style="font-size:0.75rem">0.005=0.5%</span>
          </label>
          <label class="inline-field" title="脱钩时发邮件（需配置 SMTP）">
            <input type="checkbox" id="sc-email" />
            <span>脱钩发邮件</span>
          </label>
          <label class="inline-field" title="服务端按间隔自动检测">
            <input type="checkbox" id="sc-auto" />
            <span>自动扫描</span>
          </label>
          <button type="button" class="btn-primary btn-sm" id="sc-check">${icon('refresh', 14)} 检测</button>
          <button type="button" class="btn-ghost btn-sm" id="sc-save">保存并同步</button>
          <button type="button" class="btn-ghost btn-sm" id="sc-test-mail">测试邮件</button>
        </div>
        <div class="sc-coins" id="sc-coins"></div>
        <div class="sc-add-row">
          <input class="form-input" id="sc-new-coin" placeholder="添加币种，如 TUSD" maxlength="16" />
          <button type="button" class="btn-ghost btn-sm" id="sc-add">添加</button>
        </div>
        <div id="sc-results" class="sc-results"></div>
        <p class="muted" id="sc-meta" style="font-size:0.78rem"></p>
        <p class="muted" id="sc-auto-meta" style="font-size:0.78rem"></p>
      </div>
    </section>
  `;
}

async function bindStablecoin(main, alive = () => true) {
  const card = main.querySelector('#card-sc');
  if (!card) return;
  const coinsEl = card.querySelector('#sc-coins');
  const thrEl = card.querySelector('#sc-threshold');
  const mailEl = card.querySelector('#sc-email');
  const autoEl = card.querySelector('#sc-auto');
  const resultsEl = card.querySelector('#sc-results');
  const metaEl = card.querySelector('#sc-meta');
  const autoMetaEl = card.querySelector('#sc-auto-meta');
  let coins = [];
  let threshold = 0.005;
  let emailNotify = false;
  let autoScan = false;
  let busy = false;

  /** 页面已切走则不再写 DOM */
  const canPaint = () => alive() && card.isConnected;

  function paintCoins() {
    if (!canPaint() || !coinsEl) return;
    if (!coins.length) {
      coinsEl.innerHTML = '<span class="muted">尚未选择监控币种</span>';
      return;
    }
    coinsEl.innerHTML = coins.map((c) => `
      <span class="tag-chip active">${escapeHtml(c)}
        <button type="button" class="chip-x" data-rm-sc="${escapeHtml(c)}">×</button>
      </span>
    `).join('');
    coinsEl.querySelectorAll('[data-rm-sc]').forEach((b) => {
      b.addEventListener('click', () => {
        coins = coins.filter((x) => x !== b.dataset.rmSc);
        paintCoins();
        void runCheck(false);
      });
    });
  }

  function addCoin() {
    const input = card.querySelector('#sc-new-coin');
    const raw = (input.value || '').trim().toUpperCase();
    if (!raw) return;
    if (!/^[A-Z0-9]{2,12}$/.test(raw)) {
      toast(main, '币种代码：字母数字 2–12 位', 'err');
      return;
    }
    if (!coins.includes(raw)) coins.push(raw);
    input.value = '';
    paintCoins();
    void runCheck(false);
  }

  async function saveConfig() {
    if (!isAuthenticated()) {
      toast(main, '请先登录后保存', 'err');
      return;
    }
    threshold = Math.abs(Number(thrEl.value) || 0.005);
    thrEl.value = String(threshold);
    emailNotify = mailEl.checked;
    autoScan = !!autoEl?.checked;
    try {
      await api.saveStablecoinConfig({ coins, threshold, emailNotify, autoScan });
      try {
        const rt = await api.alertsRuntime();
        if (autoMetaEl?.isConnected) {
          const sc = rt.stablecoin || {};
          autoMetaEl.textContent = sc.running
            ? `自动扫描运行中 · ${sc.intervalSec || 300}s/次 · ${sc.coins || coins.length} 币 · 阈值 ±${((sc.threshold ?? threshold) * 100).toFixed(3)}%`
            : '自动扫描已关闭 · 打开「自动扫描」后保存';
        }
      } catch { /* ignore */ }
      toast(main, autoScan ? '已保存并启动自动扫描' : '稳定币配置已保存');
      if (typeof loadHistory === 'function') { /* history refresh optional */ }
    } catch (e) {
      toast(main, '保存失败: ' + e.message, 'err');
    }
  }

  function paintResults(data) {
    if (!canPaint() || !resultsEl) return;
    const rows = data.results || [];
    if (!rows.length) {
      resultsEl.innerHTML = '<p class="muted">无结果，请添加币种</p>';
      return;
    }
    const label = { ok: '正常', depeg: '轻微脱钩', warn: '明显脱钩', critical: '严重脱钩', error: '无法获取' };
    resultsEl.innerHTML = `
      <div class="sc-table-wrap">
        <table class="sc-table">
          <thead><tr><th>币种</th><th>价格</th><th>偏离%</th><th>状态</th><th>备注</th></tr></thead>
          <tbody>
            ${rows.map((r) => {
              const sev = r.severity || 'error';
              const price = r.price == null ? '—' : Number(r.price).toFixed(6);
              const dev = r.deviation_pct == null ? '—' : `${r.deviation_pct >= 0 ? '+' : ''}${Number(r.deviation_pct).toFixed(4)}%`;
              return `<tr>
                <td class="sc-symbol">${escapeHtml(r.symbol)}</td>
                <td class="mono">${price}</td>
                <td class="mono">${dev}</td>
                <td><span class="sc-status ${sev}">${label[sev] || sev}</span></td>
                <td class="muted">${r.error ? escapeHtml(r.error) : (r.depegged ? '超出阈值' : '')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="sc-summary">
        <span>共 <strong>${data.summary?.total ?? rows.length}</strong></span>
        <span>脱钩 <strong>${data.summary?.depegged ?? 0}</strong></span>
        <span>失败 <strong>${data.summary?.errors ?? 0}</strong></span>
      </div>
    `;
  }

  async function runCheck(useMailFlag) {
    if (busy || !canPaint()) return;
    busy = true;
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="loading-state"><span class="loading-spinner"></span> 拉取 Coinbase...</div>';
    }
    try {
      threshold = Math.abs(Number(thrEl?.value) || 0.005);
      // 仅用户点「检测」时尊重邮件勾选；增删币种的自动检测不发信
      const notify = useMailFlag ? !!mailEl?.checked : false;
      const data = await api.checkStablecoins({ coins: coins.join(','), threshold, notify });
      if (!canPaint()) return;
      paintResults(data);
      const mailNote = data.email?.sent ? ' · 已发邮件' : (data.email?.error ? ` · 邮件失败: ${data.email.error}` : '');
      if (metaEl) {
        metaEl.textContent = `数据源 ${data.source} · ±${(Number(data.threshold) * 100).toFixed(3)}%${mailNote}`;
      }
      if (data.email?.sent) toast(main, '检测完成，已发送脱钩邮件');
      else if (data.summary?.depegged > 0) toast(main, `检测到 ${data.summary.depegged} 个脱钩`, 'err');
    } catch (e) {
      if (!canPaint()) return;
      if (resultsEl) resultsEl.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
      if (metaEl) metaEl.textContent = '';
    } finally {
      busy = false;
    }
  }

  try {
    const cfg = await api.stablecoinConfig();
    if (!canPaint()) return;
    coins = cfg.coins || [];
    threshold = Number(cfg.threshold) || 0.005;
    emailNotify = !!cfg.emailNotify;
    autoScan = !!cfg.autoScan;
    if (thrEl) thrEl.value = String(threshold);
    if (mailEl) mailEl.checked = emailNotify;
    if (autoEl) autoEl.checked = autoScan;
    paintCoins();
  } catch (e) {
    if (canPaint() && coinsEl) {
      coinsEl.innerHTML = `<span class="muted">配置加载失败: ${escapeHtml(e.message)}</span>`;
    }
  }

  try {
    const st = await api.emailStatus();
    if (canPaint() && metaEl) {
      metaEl.textContent = st.configured
        ? `SMTP: ${st.user} → ${st.to}`
        : 'SMTP 未配置（.env EMAIL_*）';
    }
  } catch { /* ignore */ }

  try {
    const rt = await api.alertsRuntime();
    if (canPaint() && autoMetaEl) {
      const sc = rt.stablecoin || {};
      autoMetaEl.textContent = sc.running
        ? `自动扫描运行中 · ${sc.intervalSec || 300}s/次 · ${sc.coins || 0} 币`
        : (sc.autoScan ? '自动扫描已配置但未运行，请点「保存并同步」' : '自动扫描：关闭');
    }
  } catch { /* ignore */ }

  if (!canPaint()) return;

  card.querySelector('#sc-add')?.addEventListener('click', addCoin);
  card.querySelector('#sc-new-coin')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCoin(); }
  });
  card.querySelector('#sc-save')?.addEventListener('click', saveConfig);
  card.querySelector('#sc-check')?.addEventListener('click', () => runCheck(true));
  card.querySelector('#sc-test-mail')?.addEventListener('click', async () => {
    try {
      await api.sendTestEmail();
      toast(main, '测试邮件已发送');
    } catch (e) {
      toast(main, e.message, 'err');
    }
  });

  await runCheck(false);
}

function persist(state) {
  localStorage.setItem('myweb_alerts', JSON.stringify(state));
}

function toast(main, msg, type = 'ok') {
  const el = main.querySelector('#alert-toast');
  if (!el) return;
  el.innerHTML = `<div class="toast ${type}">${escapeHtml(msg)}</div>`;
  setTimeout(() => { if (el.isConnected) el.innerHTML = ''; }, 2800);
}

function bindVol(main, state) {
  const card = main.querySelector('#card-vol');
  const metaEl = main.querySelector('#vol-monitor-meta');

  async function paintMonitorMeta() {
    if (!metaEl || !metaEl.isConnected) return;
    if (!isAuthenticated()) {
      metaEl.textContent = '登录后可启动服务端监测';
      return;
    }
    try {
      const st = await api.monitorStatus();
      if (!metaEl.isConnected) return;
      if (!st.running) {
        metaEl.textContent = '监测未运行 · 打开开关并「同步并启动」';
      } else {
        const last = st.lastRunAt ? formatTime(st.lastRunAt) : '—';
        metaEl.textContent = `监测运行中 · ${st.intervalSec || 60}s/次 · 监控 ${st.watched ?? 0} 组 · 上次 ${last} · 命中 ${st.lastHits ?? 0}${st.emailNotify ? (st.emailConfigured ? ' · 邮件开' : ' · 邮件未配置') : ''}`;
      }
    } catch {
      if (metaEl.isConnected) metaEl.textContent = '';
    }
  }

  main.querySelector('#tg-vol').addEventListener('change', async (e) => {
    state.volEnabled = e.target.checked;
    card.classList.toggle('armed', state.volEnabled);
    persist(state);
    await syncVol(main, state);
    await paintMonitorMeta();
  });
  card.querySelectorAll('.tf-chip').forEach((b) => {
    b.addEventListener('click', () => {
      const tf = b.dataset.tf;
      const i = state.timeframes.indexOf(tf);
      if (i >= 0) state.timeframes.splice(i, 1);
      else state.timeframes.push(tf);
      b.classList.toggle('active', state.timeframes.includes(tf));
      card.querySelectorAll('.th-item').forEach((item) => {
        const input = item.querySelector('[data-th-tf]');
        item.classList.toggle('dim', !state.timeframes.includes(input.dataset.thTf));
      });
      persist(state);
    });
  });
  card.querySelectorAll('[data-th-tf]').forEach((inp) => {
    inp.addEventListener('change', () => {
      state.thresholds[inp.dataset.thTf] = Number(inp.value);
      persist(state);
    });
  });
  card.querySelectorAll('[data-ex]').forEach((b) => {
    b.addEventListener('click', () => {
      const ex = b.dataset.ex;
      const i = state.exchanges.indexOf(ex);
      if (i >= 0) state.exchanges.splice(i, 1);
      else state.exchanges.push(ex);
      b.classList.toggle('active', state.exchanges.includes(ex));
      persist(state);
    });
  });
  card.querySelectorAll('[data-rm-coin]').forEach((b) => {
    b.addEventListener('click', () => {
      state.coins = state.coins.filter((c) => c !== b.dataset.rmCoin);
      persist(state);
      b.closest('.tag-chip')?.remove();
    });
  });
  main.querySelector('#coin-add')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = e.target.value.trim().toUpperCase();
    if (!v || state.coins.includes(v)) return;
    state.coins.push(v);
    persist(state);
    const wrap = main.querySelector('#vol-coins');
    if (wrap) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip active';
      chip.innerHTML = `${escapeHtml(v)} <button type="button" class="chip-x" data-rm-coin="${escapeHtml(v)}">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        state.coins = state.coins.filter((c) => c !== v);
        persist(state);
        chip.remove();
      });
      wrap.appendChild(chip);
    }
    toast(main, `已添加 ${v}`);
    e.target.value = '';
  });
  main.querySelector('#vol-email')?.addEventListener('change', (e) => {
    state.volEmailNotify = e.target.checked;
    persist(state);
  });
  main.querySelector('#vol-sync')?.addEventListener('click', async () => {
    await syncVol(main, state);
    await paintMonitorMeta();
  });
  main.querySelector('#vol-check-now')?.addEventListener('click', async () => {
    if (!isAuthenticated()) {
      toast(main, '请先登录', 'err');
      return;
    }
    try {
      await syncVol(main, state);
      const r = await api.checkVolatilityNow();
      toast(main, r.hits?.length
        ? `检测完成：命中 ${r.hits.length} 条`
        : `检测完成：暂无超阈值（监控 ${r.configs} 组）`);
      // 刷新历史
      const hist = main.querySelector('#alert-history');
      if (hist) await loadHistory(main, 1);
      await paintMonitorMeta();
    } catch (e) {
      toast(main, '检测失败: ' + e.message, 'err');
    }
  });
  paintMonitorMeta();
}

async function syncVol(main, state) {
  if (!isAuthenticated()) {
    toast(main, '请先登录后再同步到服务端', 'err');
    return;
  }
  try {
    const tfs = state.timeframes.length ? state.timeframes : ['5m'];
    const thr = {};
    tfs.forEach((tf) => {
      thr[tf] = Number(state.thresholds[tf]) || DEFAULT_TF[tf] || 1;
    });
    const exs = state.exchanges.length ? state.exchanges : ['okx'];
    const coins = state.coins.length ? state.coins : ['BTC-USDT'];
    const configs = [];
    const keys = new Set();
    for (const ex of exs) {
      for (const sym of coins) {
        keys.add(`${ex}|${sym}`);
        configs.push({
          alert_type: 'volatility',
          exchange: ex,
          symbol: sym,
          timeframes: tfs,
          thresholds: thr,
          is_enabled: state.volEnabled ? 1 : 0,
        });
      }
    }
    try {
      const existing = await api.listAlertConfigs();
      for (const c of existing || []) {
        if (c.alert_type !== 'volatility') continue;
        const k = `${c.exchange}|${c.symbol}`;
        if (!keys.has(k)) {
          configs.push({
            alert_type: 'volatility',
            exchange: c.exchange,
            symbol: c.symbol,
            timeframes: c.timeframes || tfs,
            thresholds: c.thresholds || thr,
            is_enabled: 0,
          });
        }
      }
    } catch { /* demo / 未登录已处理 */ }

    await api.saveAlertConfigs(configs);
    await api.saveVolatilityMonitorSettings({ emailNotify: !!state.volEmailNotify });

    if (state.volEnabled) {
      await api.startMonitor();
      toast(main, '波动监测已启动（服务端后台检测）');
    } else {
      await api.stopMonitor();
      toast(main, '配置已保存，监测已停止');
    }
  } catch (e) {
    toast(main, '同步失败: ' + e.message, 'err');
  }
}

function bindDd(main, state) {
  const card = main.querySelector('#card-dd');
  const metaEl = main.querySelector('#dd-monitor-meta');

  async function paintMeta() {
    if (!metaEl?.isConnected) return;
    if (!isAuthenticated()) {
      metaEl.textContent = '登录后可启动服务端监测';
      return;
    }
    try {
      const rt = await api.alertsRuntime();
      if (!metaEl.isConnected) return;
      const dd = rt.drawdown || {};
      if (!dd.hasApiKeys) {
        metaEl.textContent = '未配置交易所 API Key · 请到「设置 → 交易所」添加 OKX/Binance 只读密钥';
        return;
      }
      if (!dd.running) {
        metaEl.textContent = dd.lastError
          ? `未运行 · ${dd.lastError}`
          : `未运行 · 已配置 ${dd.exchanges?.map((e) => e.exchange).join('/') || '交易所'} · 打开开关并「同步并启动」`;
      } else {
        const ex = (dd.exchanges || []).map((e) => e.exchange).join('/') || '—';
        metaEl.textContent =
          `仓位收益回撤运行中 · ${dd.intervalSec}s/次 · 阈值 ${dd.threshold}% · 交易所 ${ex}` +
          ` · 峰值仓位 ${dd.positionPeakCount || 0} 个 · 最近回撤 ${Number(dd.lastDrawdownPct || 0).toFixed(2)}%` +
          (dd.emailNotify ? (rt.emailConfigured ? ' · 邮件开' : ' · 邮件未配置') : '');
      }
    } catch (e) {
      if (metaEl.isConnected) metaEl.textContent = e.message;
    }
  }

  async function syncDd() {
    if (!isAuthenticated()) {
      toast(main, '请先登录', 'err');
      return;
    }
    state.ddThreshold = Math.max(1, Number(main.querySelector('#dd-threshold').value) || 30);
    state.ddEmailNotify = !!main.querySelector('#dd-email')?.checked;
    persist(state);
    try {
      await api.saveDrawdownConfig({
        enabled: state.ddEnabled,
        threshold: state.ddThreshold,
        emailNotify: state.ddEmailNotify,
        mode: 'position',
      });
      await api.syncAlertsRuntime();
      toast(main, state.ddEnabled ? '仓位收益回撤监测已启动' : '回撤配置已保存（监测关闭）');
      await paintMeta();
    } catch (e) {
      toast(main, '回撤同步失败: ' + e.message, 'err');
    }
  }

  main.querySelector('#tg-dd').addEventListener('change', async (e) => {
    state.ddEnabled = e.target.checked;
    card.classList.toggle('armed', state.ddEnabled);
    persist(state);
    await syncDd();
  });
  main.querySelector('#dd-threshold')?.addEventListener('change', () => {
    state.ddThreshold = Number(main.querySelector('#dd-threshold').value) || 30;
    persist(state);
  });
  main.querySelector('#dd-email')?.addEventListener('change', (e) => {
    state.ddEmailNotify = e.target.checked;
    persist(state);
  });
  main.querySelector('#dd-sync')?.addEventListener('click', syncDd);
  main.querySelector('#dd-check-now')?.addEventListener('click', async () => {
    if (!isAuthenticated()) {
      toast(main, '请先登录', 'err');
      return;
    }
    try {
      await syncDd();
      const r = await api.checkDrawdownNow();
      if (r.ok) {
        const worst = r.worst;
        const posInfo = (r.positions || []).length
          ? `持仓 ${r.positions.length} 个 · 总浮盈 ${Number(r.totalPnl || 0).toFixed(2)}U`
          : '当前无持仓';
        const w = worst
          ? ` · 最差 ${worst.exchange}:${worst.symbol} 回撤 ${Number(worst.drawdownPct).toFixed(2)}%（峰值 ${worst.peakPnl}U→${worst.upl}U）`
          : '';
        toast(main, posInfo + w + (r.hit ? ' · 已告警' : ''), r.hit ? 'err' : 'ok');
        if (r.positions?.length) {
          console.log('[dd positions]', r.positions);
        }
      } else {
        toast(main, r.message || r.error || '检测失败', 'err');
      }
      const hist = main.querySelector('#alert-history');
      if (hist) await loadHistory(main, 1);
      await paintMeta();
    } catch (e) {
      const msg = e.message || '';
      toast(main, '回撤检测失败: ' + msg, 'err');
      await paintMeta();
    }
  });
  paintMeta();
}

function bindNews(main, state) {
  const card = main.querySelector('#card-news');
  const metaEl = main.querySelector('#news-monitor-meta');

  async function paintMeta() {
    if (!metaEl?.isConnected) return;
    if (!isAuthenticated()) {
      metaEl.textContent = '登录后可启动服务端监测';
      return;
    }
    try {
      const rt = await api.alertsRuntime();
      if (!metaEl.isConnected) return;
      const n = rt.news || {};
      if (!n.running) {
        metaEl.textContent = n.lastError ? `未运行 · ${n.lastError}` : '未运行 · 打开开关并「同步并启动」';
      } else {
        const titles = (n.lastTitles || []).slice(0, 1).join('');
        metaEl.textContent =
          `运行中 · ${n.intervalSec}s/次 · 阈值 ${n.risk} · 上次风险 ${n.lastMaxRisk || 0} · 命中 ${n.lastHits || 0}` +
          (n.aiConfigured ? ' · AI已配置' : ' · 规则评分') +
          (titles ? ` · ${titles.slice(0, 40)}` : '');
      }
    } catch (e) {
      if (metaEl.isConnected) metaEl.textContent = e.message;
    }
  }

  async function syncNews() {
    if (!isAuthenticated()) {
      toast(main, '请先登录', 'err');
      return;
    }
    state.newsRisk = Math.max(0, Math.min(100, Number(main.querySelector('#news-risk').value) || 60));
    state.newsEmailNotify = !!main.querySelector('#news-email')?.checked;
    persist(state);
    try {
      await api.saveNewsConfig({
        enabled: state.newsEnabled,
        risk: state.newsRisk,
        emailNotify: state.newsEmailNotify,
        cats: state.newsCats,
      });
      await api.syncAlertsRuntime();
      toast(main, state.newsEnabled ? '消息面监测已启动' : '消息面配置已保存（监测关闭）');
      await paintMeta();
    } catch (e) {
      toast(main, '消息面同步失败: ' + e.message, 'err');
    }
  }

  main.querySelector('#tg-news').addEventListener('change', async (e) => {
    state.newsEnabled = e.target.checked;
    card.classList.toggle('armed', state.newsEnabled);
    persist(state);
    await syncNews();
  });
  main.querySelector('#news-risk')?.addEventListener('change', (e) => {
    state.newsRisk = Number(e.target.value);
    persist(state);
  });
  main.querySelector('#news-email')?.addEventListener('change', (e) => {
    state.newsEmailNotify = e.target.checked;
    persist(state);
  });
  card.querySelectorAll('[data-cat]').forEach((cb) => {
    cb.addEventListener('change', () => {
      state.newsCats[cb.dataset.cat] = cb.checked;
      persist(state);
    });
  });
  main.querySelector('#news-sync')?.addEventListener('click', syncNews);
  main.querySelector('#news-check-now')?.addEventListener('click', async () => {
    if (!isAuthenticated()) {
      toast(main, '请先登录', 'err');
      return;
    }
    try {
      await syncNews();
      const r = await api.checkNewsNow();
      if (r.ok) {
        toast(main, `扫描 ${r.scanned || 0} 条 · 风险 ${r.maxRisk || 0} · 新命中 ${r.hits || 0}`);
      } else {
        toast(main, '新闻检测失败: ' + (r.error || ''), 'err');
      }
      const hist = main.querySelector('#alert-history');
      if (hist) await loadHistory(main, 1);
      await paintMeta();
    } catch (e) {
      toast(main, '消息面检测失败: ' + e.message, 'err');
    }
  });
  paintMeta();
}

async function loadHistory(main, page) {
  const el = main.querySelector('#alert-history');
  const pag = main.querySelector('#hist-pagination');
  if (!el) return;
  try {
    const data = await api.alertHistory({ page, limit: 20 });
    if (!el.isConnected) return;
    const alerts = data.alerts || [];
    if (!alerts.length) {
      el.innerHTML = '<div class="empty-state"><p>暂无告警</p></div>';
      if (pag) pag.innerHTML = '';
      return;
    }
    el.innerHTML = alerts.map((a) => `
      <div class="hist-item">
        <span class="hist-type ${a.alert_type}">${typeName(a.alert_type)}</span>
        <div class="hist-body">
          <div class="hist-msg">${escapeHtml(a.message || a.symbol)}</div>
          <div class="hist-meta muted">${escapeHtml(a.symbol)} · ${formatTime(a.created_at)}</div>
        </div>
      </div>
    `).join('');
    if (pag) {
      pag.innerHTML = `<button class="btn-ghost" id="hist-refresh">刷新</button>`;
      pag.querySelector('#hist-refresh').onclick = () => loadHistory(main, page);
    }
  } catch (e) {
    if (!el.isConnected) return;
    el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

function typeName(t) {
  return { volatility: '波动', drawdown: '回撤', news: '消息', stablecoin: '稳定币' }[t] || t;
}

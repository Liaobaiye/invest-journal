import api from '../api.js';
import { icon } from '../utils/icons.js';
import { escapeHtml } from '../utils/format.js';
import { applyReveal } from '../utils/motion.js';
import { isAuthenticated } from '../store.js';

const STATUS_LABEL = {
  ok: '正常',
  depeg: '轻微脱钩',
  warn: '明显脱钩',
  critical: '严重脱钩',
  error: '无法获取',
};

export async function StablecoinPage(main) {
  main.innerHTML = `
    <div class="stablecoin-page">
      <div class="page-header">
        <div>
          <h1>稳定币脱锚</h1>
          <p class="muted" style="margin-top:8px;font-size:0.9rem">
            Coinbase Spot · 目标钉住 $1.00 · 可增删监控币种
          </p>
        </div>
        <button type="button" class="btn-primary" id="sc-check">${icon('refresh', 16)} 立即检测</button>
      </div>

      ${!isAuthenticated() ? `<div class="error-banner">未登录：仅可预览，配置保存需登录</div>` : ''}

      <section class="glass-card" style="padding:20px;margin-bottom:20px">
        <div class="sc-toolbar">
          <div class="form-group" style="margin:0;min-width:160px">
            <label>脱钩阈值（绝对偏离）</label>
            <input class="form-input" type="number" id="sc-threshold" min="0.0001" max="0.5" step="0.0005" value="0.005" />
            <span class="muted" style="font-size:0.75rem">0.005 = 0.5%</span>
          </div>
          <div class="sc-add-row">
            <div class="form-group" style="margin:0">
              <label>添加币种</label>
              <input class="form-input" id="sc-new-coin" placeholder="如 TUSD" maxlength="16" />
            </div>
            <button type="button" class="btn-ghost" id="sc-add">添加</button>
          </div>
          <button type="button" class="btn-ghost" id="sc-save">保存配置</button>
        </div>
        <div class="sc-coins" id="sc-coins"></div>
      </section>

      <div class="sc-summary" id="sc-summary"></div>
      <div class="sc-table-wrap">
        <table class="sc-table">
          <thead>
            <tr>
              <th>币种</th>
              <th>价格 (USD)</th>
              <th>偏离 %</th>
              <th>偏离 bps</th>
              <th>状态</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody id="sc-body">
            <tr><td colspan="6"><div class="loading-state"><span class="loading-spinner"></span> 加载配置...</div></td></tr>
          </tbody>
        </table>
      </div>
      <p class="sc-meta" id="sc-meta"></p>

      <div class="sc-cli-hint">
        <strong>命令行</strong>（与页面同一套算法）：
        <code>python stablecoin_depeg.py --coins USDT,USDC --threshold 0.005 --proxy http://127.0.0.1:7897</code>
        支持 <code>--watch</code> 持续监控与 <code>--csv</code> 落盘。
      </div>
    </div>
  `;

  applyReveal(main);

  let coins = [];
  let threshold = 0.005;
  let refreshResults = () => {};

  const coinsEl = main.querySelector('#sc-coins');
  const thrEl = main.querySelector('#sc-threshold');
  const bodyEl = main.querySelector('#sc-body');
  const summaryEl = main.querySelector('#sc-summary');
  const metaEl = main.querySelector('#sc-meta');
  const checkBtn = main.querySelector('#sc-check');

  function paintCoins() {
    if (!coins.length) {
      coinsEl.innerHTML = '<span class="muted">尚未选择监控币种</span>';
      return;
    }
    coinsEl.innerHTML = coins.map((c) => `
      <span class="sc-coin-chip">
        ${escapeHtml(c)}
        <button type="button" data-rm="${escapeHtml(c)}" title="移除">×</button>
      </span>
    `).join('');
    coinsEl.querySelectorAll('[data-rm]').forEach((b) => {
      b.addEventListener('click', () => {
        coins = coins.filter((x) => x !== b.dataset.rm);
        paintCoins();
        refreshResults();
      });
    });
  }

  function addCoin() {
    const input = main.querySelector('#sc-new-coin');
    const raw = (input.value || '').trim().toUpperCase();
    if (!raw) return;
    if (!/^[A-Z0-9]{2,12}$/.test(raw)) {
      alert('币种代码格式：字母数字，2–12 位');
      return;
    }
    if (coins.includes(raw)) {
      input.value = '';
      return;
    }
    coins.push(raw);
    input.value = '';
    paintCoins();
    refreshResults();
  }

  async function loadConfig() {
    try {
      const cfg = await api.stablecoinConfig();
      coins = cfg.coins || [];
      threshold = Number(cfg.threshold) || 0.005;
      thrEl.value = String(threshold);
      paintCoins();
    } catch (e) {
      coinsEl.innerHTML = `<span class="muted">配置加载失败：${escapeHtml(e.message)}</span>`;
    }
  }

  async function saveConfig() {
    if (!isAuthenticated()) {
      alert('请先登录后保存配置');
      return;
    }
    threshold = Math.abs(Number(thrEl.value) || 0.005);
    thrEl.value = String(threshold);
    try {
      await api.saveStablecoinConfig({ coins, threshold });
      metaEl.textContent = '配置已保存';
    } catch (e) {
      metaEl.textContent = '保存失败：' + e.message;
    }
  }

  function paintResults(data) {
    const rows = data.results || [];
    if (!rows.length) {
      bodyEl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>无结果，请先添加币种</p></div></td></tr>`;
      summaryEl.innerHTML = '';
      metaEl.textContent = '';
      return;
    }
    bodyEl.innerHTML = rows.map((r) => {
      const sev = r.severity || 'error';
      const label = STATUS_LABEL[sev] || sev;
      const price = r.price == null ? '—' : Number(r.price).toFixed(6);
      const devPct = r.deviation_pct == null ? '—' : `${r.deviation_pct >= 0 ? '+' : ''}${Number(r.deviation_pct).toFixed(4)}%`;
      const devBps = r.deviation_bps == null ? '—' : `${r.deviation_bps >= 0 ? '+' : ''}${Number(r.deviation_bps).toFixed(1)}`;
      const note = r.error ? escapeHtml(r.error) : (r.depegged ? '超出阈值' : '');
      return `
        <tr>
          <td class="sc-symbol">${escapeHtml(r.symbol)}</td>
          <td class="mono">${price}</td>
          <td class="mono ${r.depegged ? 'down' : ''}">${devPct}</td>
          <td class="mono">${devBps}</td>
          <td><span class="sc-status ${sev}">${label}</span></td>
          <td class="muted">${note}</td>
        </tr>
      `;
    }).join('');

    const s = data.summary || {};
    summaryEl.innerHTML = `
      <span>共 <strong>${s.total ?? rows.length}</strong></span>
      <span>正常 <strong>${s.ok ?? 0}</strong></span>
      <span>脱钩 <strong class="${s.depegged ? 'down' : ''}">${s.depegged ?? 0}</strong></span>
      <span>失败 <strong>${s.errors ?? 0}</strong></span>
    `;
    metaEl.textContent = `数据源 ${data.source || 'coinbase'} · 阈值 ±${(Number(data.threshold) * 100).toFixed(3)}% · ${data.timestamp_utc || ''}`;
  }

  async function runCheck() {
    checkBtn.disabled = true;
    checkBtn.textContent = '检测中...';
    bodyEl.innerHTML = `<tr><td colspan="6"><div class="loading-state"><span class="loading-spinner"></span> 拉取 Coinbase 行情...</div></td></tr>`;
    try {
      threshold = Math.abs(Number(thrEl.value) || 0.005);
      const data = await api.checkStablecoins({ coins: coins.join(','), threshold });
      paintResults(data);
    } catch (e) {
      bodyEl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>${escapeHtml(e.message)}</p></div></td></tr>`;
      summaryEl.innerHTML = '';
    } finally {
      checkBtn.disabled = false;
      checkBtn.innerHTML = `${icon('refresh', 16)} 立即检测`;
    }
  }
  refreshResults = runCheck;

  main.querySelector('#sc-add').addEventListener('click', addCoin);
  main.querySelector('#sc-new-coin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addCoin(); }
  });
  main.querySelector('#sc-save').addEventListener('click', saveConfig);
  checkBtn.addEventListener('click', runCheck);

  await loadConfig();
  paintCoins();
  await runCheck();
}

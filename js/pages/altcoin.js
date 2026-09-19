import api from '../api.js';
import { icon } from '../utils/icons.js';
import { formatTime, formatNumber, escapeHtml } from '../utils/format.js';
import { applyReveal } from '../utils/motion.js';
import { isAuthenticated } from '../store.js';

const PARAMS_KEY = 'myweb_altcoin_params';

export async function AltcoinPage(main, ctx = {}) {
  const alive = typeof ctx.alive === 'function' ? ctx.alive : () => true;
  const saved = JSON.parse(localStorage.getItem(PARAMS_KEY) || '{}');
  const params = {
    threshold: saved.threshold ?? 5,
    daysToCheck: saved.daysToCheck ?? 10,
    previousDays: saved.previousDays ?? 7,
    maxSymbols: saved.maxSymbols ?? 0,
  };

  let pollTimer = null;
  let selected = null;
  let results = { coins: [] };
  let autoSettings = { autoScanEmail: false, intervalHours: 4, nextAutoRunAt: null, emailConfigured: false };
  let historyItems = [];

  main.innerHTML = `
    <div class="altcoin-page">
      <div class="page-header">
        <div>
          <h1>山寨币监测</h1>
          <p class="muted">Binance 现货 · 成交量异动 + 长上影形态</p>
        </div>
      </div>

      <section class="ac-toolbar glass-card">
        <div class="ac-fields">
          <label class="inline-field">
            <span>倍数阈值</span>
            <input type="number" class="form-input" id="ac-threshold" min="1" max="50" step="0.5" value="${params.threshold}" />
            <span class="muted">×</span>
          </label>
          <label class="inline-field">
            <span>检测近</span>
            <input type="number" class="form-input" id="ac-days" min="1" max="30" value="${params.daysToCheck}" />
            <span class="muted">天</span>
          </label>
          <label class="inline-field">
            <span>对比前</span>
            <input type="number" class="form-input" id="ac-prev" min="1" max="30" value="${params.previousDays}" />
            <span class="muted">天均量</span>
          </label>
          <label class="inline-field">
            <span>最多扫描</span>
            <input type="number" class="form-input" id="ac-max" min="0" step="10" value="${params.maxSymbols}" title="0 = 全量 USDT 对" />
            <span class="muted">对（0=全量）</span>
          </label>
          <button type="button" class="btn-primary" id="ac-scan">${icon('refresh', 14)} 开始扫描</button>
        </div>
        <div class="ac-auto-row">
          <label class="ac-auto-label" title="开启后服务端每 4 小时自动扫描；有异动时发邮件，并生成 HTML 历史报告">
            <span class="toggle-switch">
              <input type="checkbox" id="ac-auto-toggle" />
              <span class="track"></span>
            </span>
            <span class="ac-auto-text">
              <strong>每 4 小时自动扫描并邮件</strong>
              <span class="muted" id="ac-auto-hint">开关关闭</span>
            </span>
          </label>
        </div>
        <div class="ac-progress" id="ac-progress" hidden>
          <div class="ac-progress-bar"><div class="ac-progress-fill" id="ac-progress-fill"></div></div>
          <span class="muted" id="ac-progress-text"></span>
        </div>
        <p class="muted ac-meta" id="ac-meta"></p>
        <p class="ac-notify" id="ac-notify" hidden></p>
      </section>

      <div class="ac-stats" id="ac-stats">
        <div class="ov-card"><span class="ov-label">异动币种</span><span class="ov-value mono" id="ac-n">—</span></div>
        <div class="ov-card danger"><span class="ov-label">最高倍数</span><span class="ov-value mono" id="ac-top">—</span></div>
        <div class="ov-card"><span class="ov-label">平均倍数</span><span class="ov-value mono" id="ac-avg">—</span></div>
        <div class="ov-card"><span class="ov-label">扫描耗时</span><span class="ov-value mono" id="ac-dur">—</span></div>
      </div>

      <div class="ac-layout">
        <section class="ac-list glass-card">
          <div class="panel-head">
            <span class="panel-icon">${icon('trend', 16)}</span>
            <span>异动列表</span>
          </div>
          <div id="ac-list-body"><div class="loading-state"><span class="loading-spinner"></span></div></div>
        </section>
        <section class="ac-chart glass-card">
          <div class="panel-head">
            <span class="panel-icon">${icon('chart', 16)}</span>
            <span id="ac-chart-title">K 线预览</span>
          </div>
          <div class="ac-chart-body">
            <canvas id="ac-canvas" height="360"></canvas>
            <p class="muted" id="ac-chart-meta" style="font-size:0.78rem;margin-top:8px"></p>
          </div>
        </section>
      </div>

      <section class="ac-history glass-card">
        <div class="panel-head">
          <span class="panel-icon">${icon('chart', 16)}</span>
          <span>历史报告</span>
          <button type="button" class="btn-ghost ac-history-refresh" id="ac-history-refresh">刷新</button>
        </div>
        <p class="muted ac-history-hint">每次扫描完成后生成独立 HTML 报告（含 K 线图），点击行在新标签打开。</p>
        <div id="ac-history-body"><div class="empty-state"><p>暂无历史报告</p></div></div>
      </section>
    </div>
  `;

  applyReveal(main);
  bindControls();
  await loadInitial();
  await loadAutoSettings();
  await loadHistory();

  // 页面卸载时停掉轮询
  return () => stopPolling();

  function persistParams() {
    localStorage.setItem(PARAMS_KEY, JSON.stringify(params));
  }

  function readParams() {
    params.threshold = Math.max(1, Number(main.querySelector('#ac-threshold').value) || 5);
    params.daysToCheck = Math.max(1, Number(main.querySelector('#ac-days').value) || 10);
    params.previousDays = Math.max(1, Number(main.querySelector('#ac-prev').value) || 7);
    params.maxSymbols = Math.max(0, Number(main.querySelector('#ac-max').value) || 0);
    persistParams();
  }

  function bindControls() {
    main.querySelector('#ac-scan').addEventListener('click', startScan);
    main.querySelector('#ac-auto-toggle').addEventListener('change', onToggleAuto);
    main.querySelector('#ac-history-refresh').addEventListener('click', () => loadHistory());
  }

  async function loadAutoSettings() {
    try {
      autoSettings = await api.altcoinSettings();
      if (!alive()) return;
      paintAuto();
    } catch {
      if (!alive()) return;
      const hint = main.querySelector('#ac-auto-hint');
      if (hint) hint.textContent = '自动扫描设置加载失败（需登录后才能修改）';
    }
  }

  function paintAuto() {
    const toggle = main.querySelector('#ac-auto-toggle');
    const hint = main.querySelector('#ac-auto-hint');
    if (!toggle || !hint) return;
    toggle.checked = !!autoSettings.autoScanEmail;
    const hours = autoSettings.intervalHours || 4;
    if (!autoSettings.autoScanEmail) {
      hint.textContent = autoSettings.emailConfigured
        ? '开关关闭 · 邮件已配置'
        : '开关关闭 · 邮件未配置（server/.env EMAIL_*）';
    } else {
      const next = autoSettings.nextAutoRunAt ? formatTime(autoSettings.nextAutoRunAt) : `约 ${hours} 小时后`;
      hint.textContent = `已开启 · 每 ${hours} 小时 · 下次 ${next}${autoSettings.emailConfigured ? '' : ' · 邮件未配置'}`;
    }
  }

  async function onToggleAuto(e) {
    if (!isAuthenticated()) {
      e.target.checked = !!autoSettings.autoScanEmail;
      const meta = main.querySelector('#ac-meta');
      if (meta) meta.textContent = '请先登录后再开启自动扫描邮件';
      return;
    }
    const on = e.target.checked;
    try {
      autoSettings = await api.saveAltcoinSettings({ autoScanEmail: on });
      if (!alive()) return;
      paintAuto();
      const meta = main.querySelector('#ac-meta');
      if (meta) meta.textContent = on
        ? `已开启自动扫描（每 ${autoSettings.intervalHours || 4} 小时）· 有异动时发邮件并生成报告`
        : '已关闭自动扫描邮件';
    } catch (err) {
      if (!alive()) return;
      e.target.checked = !!autoSettings.autoScanEmail;
      const meta = main.querySelector('#ac-meta');
      if (meta) meta.textContent = '保存开关失败: ' + err.message;
    }
  }

  function paintNotify(st = null, res = null) {
    const el = main.querySelector('#ac-notify');
    if (!el) return;
    const notify = res?.lastNotify || null;
    const report = res?.lastReport || null;
    const parts = [];
    if (report && !report.error && report.file) {
      parts.push(`已生成历史报告 · ${report.coinCount ?? res?.coins?.length ?? 0} 个币`);
    } else if (report?.error) {
      parts.push('历史报告生成失败: ' + report.error);
    }
    if (notify) {
      if (notify.skipped && notify.reason === 'no_hits') parts.push('无异动，未发邮件');
      else if (notify.sent) parts.push('邮件已发送');
      else if (notify.error) parts.push('邮件: ' + notify.error);
    }
    if (st?.autoScanEmail) {
      parts.push(`自动扫描开启 · 下次 ${st.nextAutoRunAt ? formatTime(st.nextAutoRunAt) : '—'}`);
    }
    if (!parts.length) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = parts.join(' · ');
  }

  async function loadHistory() {
    const body = main.querySelector('#ac-history-body');
    if (!body) return;
    try {
      const data = await api.altcoinHistory();
      if (!alive()) return;
      historyItems = data?.items || [];
      paintHistory();
    } catch (e) {
      if (!alive()) return;
      body.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  function paintHistory() {
    const body = main.querySelector('#ac-history-body');
    if (!body) return;
    if (!historyItems.length) {
      body.innerHTML = '<div class="empty-state"><p>暂无历史报告 · 完成一次扫描后自动生成</p></div>';
      return;
    }
    body.innerHTML = `
      <div class="ac-table-wrap">
        <table class="ac-table ac-history-table">
          <thead>
            <tr><th>时间</th><th>触发</th><th>异动</th><th>最高倍数</th><th>扫描对数</th><th>耗时</th><th></th></tr>
          </thead>
          <tbody>
            ${historyItems.map((h) => `
              <tr data-file="${escapeHtml(h.file)}">
                <td class="mono">${escapeHtml(formatTime(h.scannedAt))}</td>
                <td class="muted">${h.trigger === 'auto' ? '自动' : '手动'}</td>
                <td class="mono">${h.coinCount ?? 0}</td>
                <td class="mono ac-ratio">${h.topRatio != null ? Number(h.topRatio).toFixed(2) + 'x' : '—'}</td>
                <td class="mono muted">${h.totalSymbols ?? '—'}</td>
                <td class="mono muted">${h.durationMs ? (h.durationMs / 1000).toFixed(1) + 's' : '—'}</td>
                <td><span class="ac-open-hint">打开</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    body.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        const file = tr.dataset.file;
        if (!file) return;
        window.open(`/api/altcoin/history/${encodeURIComponent(file)}`, '_blank', 'noopener');
      });
    });
  }

  async function startScan() {
    readParams();
    if (!isAuthenticated()) {
      main.querySelector('#ac-meta').textContent = '请先登录后再启动扫描';
      return;
    }
    const btn = main.querySelector('#ac-scan');
    btn.disabled = true;
    try {
      const notifyEl = main.querySelector('#ac-notify');
      if (notifyEl) {
        notifyEl.hidden = false;
        notifyEl.textContent = '扫描中… 完成后将生成 HTML 历史报告' +
          (autoSettings.autoScanEmail ? '，并按开关发送邮件' : '');
      }
      await api.startAltcoinScan({
        ...params,
        emailNotify: !!main.querySelector('#ac-auto-toggle')?.checked,
      });
      showProgress(true);
      startPolling();
    } catch (e) {
      main.querySelector('#ac-meta').textContent = e.message;
      btn.disabled = false;
    }
  }

  function showProgress(on) {
    const el = main.querySelector('#ac-progress');
    if (el) el.hidden = !on;
  }

  function startPolling() {
    stopPolling();
    const tick = async () => {
      if (!alive()) return;
      try {
        const st = await api.altcoinStatus();
        if (!alive()) return;
        paintProgress(st);
        if (st.running || st.postProcessing) {
          pollTimer = setTimeout(tick, st.postProcessing ? 800 : 1200);
        } else {
          pollTimer = null;
          showProgress(false);
          const btn = main.querySelector('#ac-scan');
          if (btn) btn.disabled = false;
          if (st.error) {
            const meta = main.querySelector('#ac-meta');
            if (meta) meta.textContent = '扫描失败: ' + st.error;
          }
          await loadResults();
          await loadHistory();
          if (st.autoScanEmail != null) {
            autoSettings = { ...autoSettings, ...st };
            paintAuto();
          }
        }
      } catch {
        pollTimer = null;
        if (!alive()) return;
        showProgress(false);
        const btn = main.querySelector('#ac-scan');
        if (btn) btn.disabled = false;
        const meta = main.querySelector('#ac-meta');
        if (meta) meta.textContent = '状态轮询失败';
      }
    };
    tick();
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function paintProgress(st) {
    const fill = main.querySelector('#ac-progress-fill');
    const text = main.querySelector('#ac-progress-text');
    const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
    if (fill) fill.style.width = pct + '%';
    if (text) {
      if (st.postProcessing) {
        text.textContent = '生成历史报告 / 发送邮件…';
      } else {
        text.textContent = st.total
          ? `${st.done}/${st.total} · ${pct}%${st.current ? ' · ' + st.current : ''}`
          : '准备交易对列表…';
      }
    }
  }

  async function loadInitial() {
    try {
      const [st, res] = await Promise.all([api.altcoinStatus(), api.altcoinResults()]);
      if (!alive()) return;
      if (st.running || st.postProcessing) {
        showProgress(true);
        paintProgress(st);
        startPolling();
      }
      results = res || { coins: [] };
      paintResults();
      paintNotify(st, results);
      if (results.coins?.length) select(results.coins[0]);
      else {
        const body = main.querySelector('#ac-list-body');
        if (body) body.innerHTML = '<div class="empty-state"><p>暂无数据，点击「开始扫描」</p></div>';
      }
    } catch (e) {
      if (!alive()) return;
      const body = main.querySelector('#ac-list-body');
      if (body) body.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  async function loadResults() {
    try {
      results = await api.altcoinResults();
      if (!alive()) return;
      paintResults();
      paintNotify(null, results);
      if (results.coins?.length) select(results.coins[0]);
    } catch (e) {
      const meta = main.querySelector('#ac-meta');
      if (meta && alive()) meta.textContent = e.message;
    }
  }

  function paintResults() {
    if (!alive()) return;
    const coins = results.coins || [];
    const body = main.querySelector('#ac-list-body');
    if (!body) return;
    const n = coins.length;
    const setText = (id, text) => {
      const el = main.querySelector(id);
      if (el) el.textContent = text;
    };
    setText('#ac-n', n || '0');
    setText('#ac-top', n ? `${coins[0].ratio.toFixed(2)}x` : '—');
    setText('#ac-avg', n
      ? `${(coins.reduce((s, c) => s + c.ratio, 0) / n).toFixed(2)}x`
      : '—');
    setText('#ac-dur', results.durationMs
      ? `${(results.durationMs / 1000).toFixed(1)}s`
      : '—');
    setText('#ac-meta', results.scannedAt
      ? `上次扫描 ${formatTime(results.scannedAt)} · 扫描 ${results.totalSymbols} 对 · 阈值 ${results.params?.threshold ?? '—'}× · 数据源 ${results.source || 'binance_spot_1d'}`
      : '');

    if (!n) {
      body.innerHTML = '<div class="empty-state"><p>暂无异动币种</p></div>';
      return;
    }

    body.innerHTML = `
      <div class="ac-table-wrap">
        <table class="ac-table">
          <thead>
            <tr><th>#</th><th>币种</th><th>异动日</th><th>倍数</th><th>现量</th><th>前均量</th></tr>
          </thead>
          <tbody>
            ${coins.map((c) => `
              <tr data-sym="${escapeHtml(c.symbol)}" data-date="${escapeHtml(c.date)}" class="${selected?.symbol === c.symbol ? 'active' : ''}">
                <td class="muted">${c.rank}</td>
                <td class="mono ac-sym">${escapeHtml(c.symbol)}</td>
                <td class="muted">${escapeHtml(c.date)}</td>
                <td class="mono ac-ratio">${c.ratio.toFixed(2)}x</td>
                <td class="mono muted">${formatCompact(c.volume)}</td>
                <td class="mono muted">${formatCompact(c.avgPrevVolume)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    body.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        const coin = coins.find((c) => c.symbol === tr.dataset.sym);
        if (coin) select(coin);
      });
    });
  }

  async function select(coin) {
    if (!alive()) return;
    selected = coin;
    main.querySelectorAll('#ac-list-body tbody tr').forEach((tr) => {
      tr.classList.toggle('active', tr.dataset.sym === coin.symbol);
    });
    const titleEl = main.querySelector('#ac-chart-title');
    const metaEl = main.querySelector('#ac-chart-meta');
    if (titleEl) titleEl.textContent = `${coin.symbol} · ${coin.ratio.toFixed(2)}x · ${coin.date}`;
    if (metaEl) metaEl.textContent = '加载 K 线…';
    try {
      const data = await api.altcoinKlines(coin.symbol, 60);
      if (!alive()) return;
      const candles = data.candles || [];
      drawChart(main.querySelector('#ac-canvas'), candles, coin);
      if (metaEl) {
        metaEl.textContent =
          `开 ${fmtPx(coin.open)} · 高 ${fmtPx(coin.high)} · 低 ${fmtPx(coin.low)} · 收 ${fmtPx(coin.close)} · 量 ${formatCompact(coin.volume)}`;
      }
    } catch (e) {
      if (metaEl && alive()) metaEl.textContent = 'K 线加载失败: ' + e.message;
    }
  }
}

function formatCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
}

function fmtPx(n) {
  const v = Number(n) || 0;
  if (v >= 100) return v.toFixed(2);
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawChart(canvas, candles, spike) {
  if (!canvas || !candles.length) return;
  const parent = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(280, parent.clientWidth - 8);
  const height = 360;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 18, right: 12, bottom: 28, left: 56 };
  const volH = 70;
  const gap = 10;
  const priceH = height - pad.top - pad.bottom - volH - gap;
  const plotW = width - pad.left - pad.right;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const rangeP = maxP - minP || 1;
  const maxV = Math.max(...candles.map((c) => c.volume), 1);

  const n = candles.length;
  const slot = plotW / n;
  const bodyW = Math.max(2, Math.min(10, slot * 0.65));

  const green = cssVar('--color-green', '#4ade80');
  const red = cssVar('--color-red', '#f87171');
  const dim = cssVar('--color-text-dim', '#8088a8');
  const accent = cssVar('--color-accent', '#f0c060');
  const grid = 'rgba(128,128,128,0.18)';

  const yPrice = (p) => pad.top + ((maxP - p) / rangeP) * priceH;
  const xAt = (i) => pad.left + slot * i + slot / 2;

  // grid + y labels
  ctx.strokeStyle = grid;
  ctx.fillStyle = dim;
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (priceH * i) / 4;
    const val = maxP - (rangeP * i) / 4;
    ctx.beginPath();
    ctx.setLineDash([3, 4]);
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(fmtPx(val), pad.left - 6, y + 4);
  }

  // candles
  candles.forEach((c, i) => {
    const up = c.close >= c.open;
    const color = up ? green : red;
    const x = xAt(i);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yPrice(c.high));
    ctx.lineTo(x, yPrice(c.low));
    ctx.stroke();

    const top = yPrice(Math.max(c.open, c.close));
    const bot = yPrice(Math.min(c.open, c.close));
    const h = Math.max(1, bot - top);
    ctx.fillStyle = color;
    ctx.fillRect(x - bodyW / 2, top, bodyW, h);
  });

  // volume bars
  const volTop = pad.top + priceH + gap;
  candles.forEach((c, i) => {
    const up = c.close >= c.open;
    const h = (c.volume / maxV) * volH;
    ctx.fillStyle = up ? 'rgba(74,222,128,0.45)' : 'rgba(248,113,113,0.45)';
    ctx.fillRect(xAt(i) - bodyW / 2, volTop + volH - h, bodyW, h);
  });
  ctx.fillStyle = dim;
  ctx.textAlign = 'left';
  ctx.fillText('Volume', pad.left, volTop + 10);

  // spike marker
  if (spike?.date) {
    const idx = candles.findIndex((c) => new Date(c.openTime).toISOString().slice(0, 10) === spike.date);
    if (idx >= 0) {
      const x = xAt(idx);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, volTop + volH);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = `${spike.ratio.toFixed(1)}x`;
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = Math.min(x + 6, width - tw - 12);
      const ly = pad.top + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(lx - 4, ly - 2, tw + 8, 18);
      ctx.fillStyle = accent;
      ctx.textAlign = 'left';
      ctx.fillText(label, lx, ly + 12);
    }
  }
}

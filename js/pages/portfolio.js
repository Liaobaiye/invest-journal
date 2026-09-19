import api from '../api.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatPercent, formatNumber, escapeHtml } from '../utils/format.js';
import { applyReveal, animateNumber } from '../utils/motion.js';
import { renderCrystal, renderExchangeBadge } from '../components/shared.js';
import { isAuthenticated } from '../store.js';

export async function PortfolioPage(main) {
  let exchange = 'unified';
  let page = 1;

  main.innerHTML = `
    <div class="portfolio-page">
      <div class="page-header">
        <h1>投资组合</h1>
        <div class="port-actions">
          <div id="crystal-slot">${renderCrystal(exchange, 'single', true)}</div>
          <button type="button" class="btn-primary" id="btn-sync">${icon('refresh', 16)} 刷新数据</button>
        </div>
      </div>
      <div id="sync-error"></div>
      <div class="overview-cards" id="overview-cards">
        <div class="ov-card main"><span class="ov-label">总权益</span><span class="ov-value mono" id="ov-equity">—</span></div>
        <div class="ov-card up"><span class="ov-label">持仓浮盈</span><span class="ov-value mono" id="ov-upl">—</span></div>
        <div class="ov-card"><span class="ov-label">当前持仓</span><span class="ov-value mono" id="ov-open">—</span></div>
        <div class="ov-card"><span class="ov-label">历史平仓</span><span class="ov-value mono" id="ov-closed">—</span></div>
      </div>
      <section class="pnl-section glass-card">
        <h3 class="section-title">收益曲线</h3>
        <canvas id="pnl-canvas" height="220"></canvas>
      </section>
      <section class="positions-section">
        <h3 class="section-title">当前持仓</h3>
        <div class="positions-grid" id="positions-grid"><div class="loading-state"><span class="loading-spinner"></span></div></div>
      </section>
      <section class="history-section">
        <h3 class="section-title">历史平仓</h3>
        <div class="positions-grid" id="history-grid"></div>
        <div class="pagination" id="history-pagination"></div>
      </section>
    </div>
  `;

  applyReveal(main);

  function paintCrystal() {
    const slot = main.querySelector('#crystal-slot');
    slot.innerHTML = renderCrystal(exchange, 'single', true);
    slot.querySelectorAll('.crystal-node').forEach((btn) => {
      btn.addEventListener('click', () => {
        exchange = btn.dataset.key;
        paintCrystal();
        load();
      });
    });
  }
  paintCrystal();

  main.querySelector('#btn-sync').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const result = await api.portfolioSync(mapExchange(exchange));
      if (result?.syncResult?.errors?.length) {
        main.querySelector('#sync-error').innerHTML = `<div class="error-banner">${result.syncResult.errors.map(escapeHtml).join('<br>')}</div>`;
      } else if (result?.syncResult?.cooldown) {
        main.querySelector('#sync-error').innerHTML = `<div class="success-banner">同步冷却中，展示缓存数据</div>`;
      } else {
        main.querySelector('#sync-error').innerHTML = '';
      }
      paint(result);
    } catch (err) {
      main.querySelector('#sync-error').innerHTML = `<div class="error-banner">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  });

  async function load() {
    if (!isAuthenticated()) {
      main.querySelector('#positions-grid').innerHTML =
        `<div class="empty-state"><p>登录后可查看交易所持仓</p><a class="btn-primary" href="#/login">去登录</a></div>`;
      return;
    }
    try {
      const data = await api.portfolioOverview(mapExchange(exchange), page, 5);
      paint(data);
    } catch (e) {
      main.querySelector('#positions-grid').innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
    }
  }

  function mapExchange(ex) {
    if (ex === 'unified') return 'all';
    return ex;
  }

  function paint(data) {
    if (!data) return;
    animateNumber(main.querySelector('#ov-equity'), data.totalEquity || 0, 'currency');
    const upl = data.unrealizedPnl || 0;
    const uplEl = main.querySelector('#ov-upl');
    uplEl.className = `ov-value mono ${upl >= 0 ? 'up' : 'down'}`;
    animateNumber(uplEl, upl, 'currency');
    main.querySelector('#ov-open').textContent = String((data.currentPositions || []).length);
    main.querySelector('#ov-closed').textContent = String((data.historizedPositions || []).length);

    const open = data.currentPositions || [];
    const grid = main.querySelector('#positions-grid');
    grid.innerHTML = open.length
      ? open.map((p) => renderPositionCard(p, false)).join('')
      : '<div class="empty-state"><p>暂无持仓</p></div>';

    const hist = data.historizedPositions || [];
    const hgrid = main.querySelector('#history-grid');
    hgrid.innerHTML = hist.length
      ? hist.map((p) => renderPositionCard(p, true)).join('')
      : '<div class="empty-state"><p>暂无历史</p></div>';

    const pag = data.historyPagination || {};
    const hp = main.querySelector('#history-pagination');
    hp.innerHTML = `
      <button class="btn-ghost" ${page <= 1 ? 'disabled' : ''} data-hpage="${page - 1}">上一页</button>
      <span class="page-info mono">${page}</span>
      <button class="btn-ghost" ${(hist.length < (pag.limit || 5)) ? 'disabled' : ''} data-hpage="${page + 1}">下一页</button>
    `;
    hp.querySelectorAll('[data-hpage]').forEach((b) => {
      b.addEventListener('click', () => {
        page = Number(b.dataset.hpage);
        if (page < 1) return;
        load();
      });
    });

    drawCurve(main.querySelector('#pnl-canvas'), data.pnlCurve || []);
  }

  await load();
}

function renderPositionCard(p, closed) {
  const side = (p.pos_side || 'long').toLowerCase();
  const sideLabel = side === 'short' ? '空' : '多';
  const sideCls = side === 'short' ? 'down' : 'up';
  const pnl = Number(closed ? p.pnl : p.upl) || 0;
  const lever = p.lever ? `${p.lever}x` : '';
  return `
    <article class="position-card glass-card">
      <div class="pos-head">
        ${renderExchangeBadge(p.exchange)}
        <span class="pos-inst mono">${escapeHtml(p.inst_id)}</span>
        <span class="pos-side ${sideCls}">${sideLabel}</span>
        ${lever ? `<span class="pos-lever">${lever}</span>` : ''}
        ${closed ? '<span class="pos-closed">已平仓</span>' : ''}
        <span class="pos-pnl mono ${pnl >= 0 ? 'up' : 'down'}">${formatCurrency(pnl)}</span>
      </div>
      <div class="pos-stats">
        <div><span class="k">开仓均价</span><span class="v mono">${formatNumber(p.open_avg_px, 2)}</span></div>
        <div><span class="k">标记价格</span><span class="v mono">${formatNumber(p.mark_px || p.close_avg_px, 2)}</span></div>
        <div><span class="k">数量</span><span class="v mono">${escapeHtml(String(p.max_size || '—'))}</span></div>
        <div><span class="k">保证金</span><span class="v mono">${formatCurrency(p.margin || 0)}</span></div>
        <div><span class="k">收益率</span><span class="v mono ${pnl >= 0 ? 'up' : 'down'}">${formatPercent(((Number(closed ? p.pnl_ratio : p.upl_ratio) || 0) * 100))}</span></div>
      </div>
    </article>
  `;
}

function drawCurve(canvas, points) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth - 32;
  const height = 220;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 16, right: 16, bottom: 24, left: 56 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  if (!points.length) {
    ctx.fillStyle = 'rgba(128,136,168,0.6)';
    ctx.font = '12px sans-serif';
    ctx.fillText('暂无收益数据', pad.left, pad.top + h / 2);
    return;
  }

  const values = points.map((p) => Number(p.value) || 0);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  // grid
  ctx.strokeStyle = 'rgba(128,128,128,0.15)';
  ctx.fillStyle = 'rgba(128,136,168,0.7)';
  ctx.font = '11px monospace';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (h * i) / 4;
    const val = max - (range * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + w, y);
    ctx.stroke();
    ctx.fillText(val.toFixed(0), 8, y + 4);
  }

  // zero line
  if (min < 0 && max > 0) {
    const zy = pad.top + ((max - 0) / range) * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zy);
    ctx.lineTo(pad.left + w, zy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const pts = values.map((v, i) => ({
    x: pad.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w),
    y: pad.top + ((max - v) / range) * h,
  }));

  const total = values[values.length - 1] || 0;
  const lineColor = total >= 0 ? '#4ade80' : '#f87171';
  const fillColor = total >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)';

  // area
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const cx = (prev.x + cur.x) / 2;
    ctx.bezierCurveTo(cx, prev.y, cx, cur.y, cur.x, cur.y);
  }
  ctx.lineTo(pts[pts.length - 1].x, pad.top + h);
  ctx.lineTo(pts[0].x, pad.top + h);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  // line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const cx = (prev.x + cur.x) / 2;
    ctx.bezierCurveTo(cx, prev.y, cx, cur.y, cur.x, cur.y);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.shadowColor = lineColor;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // end dot
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = lineColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
  ctx.strokeStyle = lineColor;
  ctx.globalAlpha = 0.4;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

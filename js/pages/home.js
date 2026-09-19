import api from '../api.js';
import { icon } from '../utils/icons.js';
import { formatCurrency, formatNumber, formatPercent, escapeHtml, formatTime } from '../utils/format.js';
import { applyReveal, animateNumber } from '../utils/motion.js';
import { renderBlogCard } from '../components/shared.js';

export async function HomePage(main) {
  main.innerHTML = `
    <div class="home-page">
      <section class="hero">
        <canvas class="particle-canvas" id="hero-particles"></canvas>
        <div class="hero-grid">
          <div class="hero-copy">
            <div class="hero-badge reveal">
              <span class="live-dot"></span>
              市场观察中
            </div>
            <h1 class="hero-title reveal" style="--reveal-delay:80ms">
              记录每一笔<span class="highlight highlight--one">交易</span><br>
              追踪每一次<span class="highlight highlight--two">成长</span>
            </h1>
            <p class="hero-subtitle reveal" style="--reveal-delay:180ms">
              个人的投资日志，用数据说话，让时间见证
            </p>
            <div class="hero-actions reveal" style="--reveal-delay:280ms">
              <a href="#/blog" class="btn-primary">${icon('blog', 17)} 浏览博客</a>
              <a href="#/portfolio" class="btn-ghost">查看组合 ${icon('arrow', 17)}</a>
            </div>
          </div>
          <aside class="hero-market reveal" style="--reveal-delay:200ms">
            <div class="market-orb">
              <span class="market-ring market-ring--one"></span>
              <span class="market-ring market-ring--two"></span>
              <div class="market-core">
                <span class="market-label">BTC / USDT</span>
                <strong class="market-price" id="btc-price">$—</strong>
                <span class="market-change" id="btc-change">—</span>
              </div>
            </div>
            <div class="market-mini" id="market-mini"></div>
          </aside>
        </div>
      </section>

      <section class="stats-row" id="stats-row">
        <div class="stat-card reveal" style="--reveal-delay:0ms">
          <span class="stat-icon">${icon('blog', 22)}</span>
          <div class="stat-info">
            <span class="stat-num" id="stat-posts">0</span>
            <span class="stat-label">文章</span>
          </div>
        </div>
        <div class="stat-card reveal" style="--reveal-delay:70ms">
          <span class="stat-icon">${icon('comments', 22)}</span>
          <div class="stat-info">
            <span class="stat-num" id="stat-comments">0</span>
            <span class="stat-label">评论</span>
          </div>
        </div>
        <div class="stat-card reveal" style="--reveal-delay:140ms">
          <span class="stat-icon">${icon('btc', 22)}</span>
          <div class="stat-info">
            <span class="stat-num" id="stat-btc">$0</span>
            <span class="stat-label">BTC 价格</span>
          </div>
        </div>
        <div class="stat-card reveal" style="--reveal-delay:210ms">
          <span class="stat-icon">${icon('trend', 22)}</span>
          <div class="stat-info">
            <span class="stat-num" id="stat-change">0%</span>
            <span class="stat-label">BTC 24h</span>
          </div>
        </div>
      </section>

      <div class="home-dashboard">
        <section class="chart-strip reveal" style="--reveal-delay:120ms">
          <div class="chart-header">
            <span class="section-title">市场律动</span>
            <span class="btc-price mono" id="chart-btc-price"></span>
          </div>
          <div class="candle-bars" id="candle-bars"><div class="chart-loading">加载K线数据...</div></div>
        </section>
        <section class="latest-posts reveal" style="--reveal-delay:160ms">
          <div class="latest-head">
            <span class="section-title">最新文章</span>
            <a href="#/blog" class="view-all">全部 ${icon('arrow', 14)}</a>
          </div>
          <div class="post-grid home-post-grid" id="home-posts"><div class="loading-state"><span class="loading-spinner"></span> 加载中...</div></div>
        </section>
      </div>
    </div>
  `;

  applyReveal(main);
  startHeroParticles(main.querySelector('#hero-particles'));
  loadMarket(main);
  loadPosts(main);
  loadStats(main);
}

async function loadStats(main) {
  try {
    const s = await api.stats();
    animateNumber(main.querySelector('#stat-posts'), s.posts || 0, 'number');
    animateNumber(main.querySelector('#stat-comments'), s.comments || 0, 'number');
  } catch { /* ignore */ }
}

async function loadMarket(main) {
  try {
    const [ticker, candles] = await Promise.all([
      api.ticker('BTC-USDT', 'okx'),
      api.candles('BTC-USDT', '1D', 40, 'okx'),
    ]);
    const last = Number(ticker.last) || Number(ticker.data?.[0]?.last) || 0;
    const open = Number(ticker.open24h) || Number(ticker.open) || last;
    const change = open ? ((last - open) / open) * 100 : 0;

    const priceEl = main.querySelector('#btc-price');
    const changeEl = main.querySelector('#btc-change');
    const chartPrice = main.querySelector('#chart-btc-price');
    if (priceEl) priceEl.textContent = formatCurrency(last, 0);
    if (changeEl) {
      changeEl.className = `market-change ${change >= 0 ? 'up' : 'down'}`;
      changeEl.innerHTML = `${icon('trend', 15)} ${formatPercent(change)} · 24h`;
    }
    if (chartPrice) {
      chartPrice.className = `btc-price mono ${change >= 0 ? 'up' : 'down'}`;
      chartPrice.innerHTML = `${formatCurrency(last, 0)} <small>${formatPercent(change)}</small>`;
    }
    animateNumber(main.querySelector('#stat-btc'), last, 'currency');
    animateNumber(main.querySelector('#stat-change'), change, 'percent');

    const parsed = (Array.isArray(candles) ? candles : []).map((c) => ({
      ts: Number(c[0]), open: Number(c[1]), high: Number(c[2]), low: Number(c[3]), close: Number(c[4]),
      confirm: c[8] == null ? 1 : Number(c[8]),
    }))
      .filter((c) => Number.isFinite(c.close) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low))
      // OKX 返回「最新在前」；绘图按时间从左到右（旧→新）
      .sort((a, b) => a.ts - b.ts)
      // 去掉未收盘的最后一根，避免半截柱
      .filter((c, i, arr) => !(i === arr.length - 1 && c.confirm === 0));

    renderMiniCandles(main.querySelector('#market-mini'), parsed.slice(-12));
    renderCandles(main.querySelector('#candle-bars'), parsed);
  } catch (e) {
    console.warn('market load failed', e);
  }
}

function renderMiniCandles(el, candles) {
  if (!el) return;
  el.innerHTML = candles.map((c) => {
    const body = Math.abs(c.close - c.open);
    const range = Math.max(1, c.high - c.low);
    const h = 10 + (body / range) * 34;
    return `<div class="mini-candle ${c.close >= c.open ? 'up' : 'down'}" style="height:${h}px"></div>`;
  }).join('');
}

function renderCandles(el, candles) {
  if (!el) return;
  if (!candles.length) {
    el.innerHTML = '<div class="chart-loading">暂无 K 线数据</div>';
    return;
  }
  const all = candles.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  // 留 6% 边距，避免最高/最低贴边
  const padPct = 3;
  const plot = 100 - padPct * 2;
  el.innerHTML = candles.map((c, i) => {
    const y = (price) => padPct + ((max - price) / range) * plot;
    const wickTop = y(c.high);
    const wickH = Math.max(0.8, y(c.low) - y(c.high));
    const bodyTop = y(Math.max(c.open, c.close));
    const bodyH = Math.max(1.2, Math.abs(c.open - c.close) / range * plot);
    const cls = c.close >= c.open ? 'up' : 'down';
    return `
      <div class="candle" style="animation-delay:${Math.min(i * 0.02, 0.6)}s" title="${new Date(c.ts).toISOString().slice(0, 10)}  O:${c.open}  H:${c.high}  L:${c.low}  C:${c.close}">
        <div class="candle-wick" style="height:${wickH}%;top:${wickTop}%"></div>
        <div class="candle-body ${cls}" style="height:${bodyH}%;top:${bodyTop}%"></div>
      </div>
    `;
  }).join('');
}

async function loadPosts(main) {
  const el = main.querySelector('#home-posts');
  try {
    const data = await api.listPosts({ page: 1, limit: 3 });
    if (!data.posts?.length) {
      el.innerHTML = `<div class="empty-state">${icon('blog', 42)}<p>还没有文章</p></div>`;
      return;
    }
    el.innerHTML = data.posts.map((p, i) => renderBlogCard(p, i)).join('');
    applyReveal(el);
  } catch {
    el.innerHTML = `<div class="empty-state"><p>加载文章失败</p></div>`;
  }
}

function startHeroParticles(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const resize = () => {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
  };
  resize();
  window.addEventListener('resize', resize);
  const dots = Array.from({ length: 30 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2 + 0.5,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    hue: Math.random() > 0.5 ? 40 : 260,
  }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = canvas.width;
      if (d.x > canvas.width) d.x = 0;
      if (d.y < 0) d.y = canvas.height;
      if (d.y > canvas.height) d.y = 0;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${d.hue}, 80%, 65%, 0.35)`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

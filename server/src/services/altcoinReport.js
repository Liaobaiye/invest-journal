/**
 * 山寨币扫描历史报告 — 生成独立可打开的 HTML（内嵌 K 线数据 + canvas）
 * 落盘目录: server/src/data/altcoin_reports/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPORT_DIR = path.join(__dirname, '..', 'data', 'altcoin_reports');
const INDEX_FILE = path.join(REPORT_DIR, 'index.json');
const MAX_HISTORY = 50;
const DEFAULT_TOP_N = 30;
const CHART_DAYS = 60;

function ensureDir() {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
}

/** 邮件/列表里用的完整对外地址；部署时用 PUBLIC_BASE_URL 覆盖 */
export function publicBaseUrl() {
  const raw = (process.env.PUBLIC_BASE_URL || process.env.SITE_BASE_URL || '').trim();
  if (raw) return raw.replace(/\/+$/, '');
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}

export function absoluteReportUrl(file) {
  return `${publicBaseUrl()}/api/altcoin/history/${file}`;
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
}

function loadIndex() {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) return { items: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

function saveIndex(index) {
  ensureDir();
  const tmp = INDEX_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2));
  fs.renameSync(tmp, INDEX_FILE);
}

export function listReports() {
  return loadIndex().items.map((item) => ({
    ...item,
    urlPath: absoluteReportUrl(item.file),
  }));
}

export function readReportFile(id) {
  const safe = String(id || '').replace(/[^\w.\-]/g, '');
  if (!safe || safe.includes('..') || !safe.endsWith('.html')) return null;
  const file = path.resolve(REPORT_DIR, safe);
  const root = path.resolve(REPORT_DIR);
  if (!file.startsWith(root + path.sep) && file !== root) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}

function pruneHistory() {
  const index = loadIndex();
  if (index.items.length <= MAX_HISTORY) return;
  const drop = index.items.slice(MAX_HISTORY);
  index.items = index.items.slice(0, MAX_HISTORY);
  for (const item of drop) {
    try {
      const f = path.join(REPORT_DIR, item.file);
      if (f.startsWith(REPORT_DIR) && fs.existsSync(f)) fs.unlinkSync(f);
    } catch { /* ignore */ }
  }
  saveIndex(index);
}

async function collectCharts(coins, topN, fetchKlines) {
  const top = (coins || []).slice(0, topN);
  const charts = [];
  const workers = Math.min(5, Math.max(1, top.length));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= top.length) break;
        const coin = top[i];
        try {
          if (typeof fetchKlines !== 'function') throw new Error('fetchKlines missing');
          const candles = await fetchKlines(coin.symbol, CHART_DAYS);
          charts.push({ ...coin, candles });
        } catch {
          charts.push({ ...coin, candles: [] });
        }
      }
    })
  );
  // keep original rank order
  const bySym = new Map(charts.map((c) => [c.symbol, c]));
  return top.map((c) => bySym.get(c.symbol) || { ...c, candles: [] });
}

function renderReportHtml({ meta, charts }) {
  const payload = JSON.stringify({ meta, charts }).replace(/</g, '\\u003c');
  const genTime = escHtml(meta.scannedAt || new Date().toISOString());
  const n = meta.coinCount || 0;
  const topRatio = meta.topRatio != null ? `${Number(meta.topRatio).toFixed(2)}x` : '—';
  const avgRatio = meta.avgRatio != null ? `${Number(meta.avgRatio).toFixed(2)}x` : '—';
  const thr = meta.params?.threshold ?? '—';
  const days = meta.params?.daysToCheck ?? '—';
  const prev = meta.params?.previousDays ?? '—';
  const trigger = meta.trigger === 'auto' ? '自动' : '手动';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>山寨币异动报告 · ${genTime}</title>
<style>
  :root {
    --bg: #0a0a14;
    --card: #12122a;
    --border: rgba(255,255,255,0.08);
    --text: #e8e8f0;
    --dim: #8088a8;
    --accent: #f0c060;
    --red: #f87171;
    --green: #4ade80;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 24px 16px 40px;
  }
  .wrap { max-width: 1180px; margin: 0 auto; }
  header {
    display: flex; flex-wrap: wrap; justify-content: space-between;
    gap: 16px; margin-bottom: 18px; align-items: flex-start;
  }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .sub { color: var(--dim); font-size: 13px; line-height: 1.6; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; }
  .stat {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 10px 14px; min-width: 100px;
  }
  .stat .label { font-size: 11px; color: var(--dim); }
  .stat .value { font-size: 20px; font-weight: 700; margin-top: 4px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  .stat .value.danger { color: var(--red); }
  .layout {
    display: grid; grid-template-columns: 340px 1fr; gap: 14px; align-items: start;
  }
  .list, .preview {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 14px; overflow: hidden;
  }
  .list-head, .preview-title {
    padding: 12px 16px; font-size: 13px; color: var(--dim);
    border-bottom: 1px solid var(--border);
  }
  .coin-item {
    display: grid; grid-template-columns: 40px 1fr 88px 64px;
    gap: 8px; align-items: center; padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    cursor: pointer; transition: background .12s;
  }
  .coin-item:hover, .coin-item.active { background: rgba(240,192,96,0.08); }
  .coin-item:last-child { border-bottom: none; }
  .rank { color: var(--dim); font-size: 12px; }
  .sym { font-weight: 700; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; }
  .date { color: var(--dim); font-size: 12px; }
  .ratio { justify-self: end; color: var(--red); font-weight: 700; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  .preview { position: sticky; top: 16px; min-height: 480px; display: flex; flex-direction: column; }
  .preview-body { flex: 1; padding: 12px 16px 16px; }
  .preview-body canvas { width: 100%; display: block; border-radius: 8px; background: rgba(255,255,255,0.03); }
  .meta { margin-top: 8px; color: var(--dim); font-size: 12px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  .empty { color: var(--dim); text-align: center; padding: 48px 16px; font-size: 14px; line-height: 1.7; }
  footer { margin-top: 22px; color: var(--dim); font-size: 12px; }
  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .preview { position: static; min-height: 360px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>山寨币成交量异动报告</h1>
      <div class="sub">
        扫描时间 ${genTime} · 触发 ${trigger} · 数据源 Binance 现货日线<br/>
        规则：成交量 &gt; ${escHtml(thr)}× 前 ${escHtml(prev)} 日均量 · 检测近 ${escHtml(days)} 天 · 实体 ≤ 上影线
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">异动数量</div><div class="value">${n}</div></div>
      <div class="stat"><div class="label">最高倍数</div><div class="value danger">${topRatio}</div></div>
      <div class="stat"><div class="label">平均倍数</div><div class="value">${avgRatio}</div></div>
      <div class="stat"><div class="label">扫描对数</div><div class="value">${escHtml(meta.totalSymbols ?? '—')}</div></div>
    </div>
  </header>
  <div class="layout">
    <div class="list">
      <div class="list-head">币种列表 · 点击查看 K 线</div>
      <div id="coinList"></div>
    </div>
    <div class="preview">
      <div class="preview-title" id="previewTitle">K 线预览</div>
      <div class="preview-body">
        <canvas id="chart" height="400"></canvas>
        <div class="meta" id="chartMeta"></div>
      </div>
    </div>
  </div>
  <footer>投资日志 · 山寨币监测历史报告 · 本页为离线快照，数据不再更新</footer>
</div>
<script>
const DATA = ${payload};
const listEl = document.getElementById('coinList');
const titleEl = document.getElementById('previewTitle');
const metaEl = document.getElementById('chartMeta');
const canvas = document.getElementById('chart');
const charts = DATA.charts || [];

function fmtCompact(n) {
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

if (!charts.length) {
  listEl.innerHTML = '<div class="empty">本次扫描无异动币种</div>';
} else {
  listEl.innerHTML = charts.map((c, i) => \`
    <div class="coin-item" data-i="\${i}">
      <span class="rank">#\${c.rank || i + 1}</span>
      <span class="sym">\${c.symbol}</span>
      <span class="date">\${c.date || ''}</span>
      <span class="ratio">\${(c.ratio || 0).toFixed(2)}x</span>
    </div>\`).join('');
  listEl.querySelectorAll('.coin-item').forEach((el) => {
    el.addEventListener('click', () => select(Number(el.dataset.i)));
    el.addEventListener('mouseenter', () => select(Number(el.dataset.i)));
  });
}

function select(i) {
  const coin = charts[i];
  if (!coin) return;
  listEl.querySelectorAll('.coin-item').forEach((el, j) => el.classList.toggle('active', j === i));
  titleEl.textContent = \`#\${coin.rank || i + 1} \${coin.symbol} · \${(coin.ratio || 0).toFixed(2)}x · \${coin.date || ''}\`;
  metaEl.textContent = \`开 \${fmtPx(coin.open)} · 高 \${fmtPx(coin.high)} · 低 \${fmtPx(coin.low)} · 收 \${fmtPx(coin.close)} · 量 \${fmtCompact(coin.volume)} · 前均 \${fmtCompact(coin.avgPrevVolume)}\`;
  drawChart(coin);
}

function drawChart(coin) {
  const candles = coin.candles || [];
  const parent = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(280, parent.clientWidth - 8);
  const height = 400;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!candles.length) {
    ctx.fillStyle = '#8088a8';
    ctx.font = '14px sans-serif';
    ctx.fillText('该币种暂无 K 线数据', 24, 40);
    return;
  }
  const pad = { top: 18, right: 12, bottom: 28, left: 56 };
  const volH = 70, gap = 10;
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
  const yPrice = (p) => pad.top + ((maxP - p) / rangeP) * priceH;
  const xAt = (i) => pad.left + slot * i + slot / 2;
  ctx.strokeStyle = 'rgba(128,128,128,0.18)';
  ctx.fillStyle = '#8088a8';
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
  candles.forEach((c, i) => {
    const up = c.close >= c.open;
    const color = up ? '#4ade80' : '#f87171';
    const x = xAt(i);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yPrice(c.high));
    ctx.lineTo(x, yPrice(c.low));
    ctx.stroke();
    const top = yPrice(Math.max(c.open, c.close));
    const bot = yPrice(Math.min(c.open, c.close));
    ctx.fillStyle = color;
    ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1, bot - top));
  });
  const volTop = pad.top + priceH + gap;
  candles.forEach((c, i) => {
    const up = c.close >= c.open;
    const h = (c.volume / maxV) * volH;
    ctx.fillStyle = up ? 'rgba(74,222,128,0.45)' : 'rgba(248,113,113,0.45)';
    ctx.fillRect(xAt(i) - bodyW / 2, volTop + volH - h, bodyW, h);
  });
  ctx.fillStyle = '#8088a8';
  ctx.textAlign = 'left';
  ctx.fillText('Volume', pad.left, volTop + 10);
  if (coin.date) {
    const idx = candles.findIndex((c) => {
      const d = new Date(c.openTime);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === coin.date;
    });
    if (idx >= 0) {
      const x = xAt(idx);
      ctx.strokeStyle = '#f0c060';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, volTop + volH);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = (coin.ratio || 0).toFixed(1) + 'x';
      ctx.font = 'bold 12px sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = Math.min(x + 6, width - tw - 12);
      const ly = pad.top + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(lx - 4, ly - 2, tw + 8, 18);
      ctx.fillStyle = '#f0c060';
      ctx.textAlign = 'left';
      ctx.fillText(label, lx, ly + 12);
    }
  }
}

if (charts.length) select(0);
window.addEventListener('resize', () => {
  const active = listEl.querySelector('.coin-item.active');
  if (active) select(Number(active.dataset.i) || 0);
});
</script>
</body>
</html>`;
}

/**
 * 扫描结束后生成历史 HTML，并写入 index.json
 * @returns {object|null} 报告元数据（含 id/file/urlPath）
 */
export async function buildAltcoinReport(scanResult, options = {}) {
  const coins = scanResult.coins || [];
  const topN = Math.max(1, Number(options.topN) || DEFAULT_TOP_N);
  const charts = await collectCharts(coins, topN, options.fetchKlines);

  const n = coins.length;
  const topRatio = n ? coins[0].ratio : null;
  const avgRatio = n ? coins.reduce((s, c) => s + (c.ratio || 0), 0) / n : null;
  const scannedAt = scanResult.scannedAt || new Date().toISOString();
  const stamp = scannedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const id = `${stamp}-${Math.random().toString(36).slice(2, 7)}`;
  const file = `${id}.html`;

  const meta = {
    id,
    file,
    scannedAt,
    trigger: options.trigger || 'manual',
    coinCount: n,
    topRatio,
    avgRatio,
    params: scanResult.params || null,
    totalSymbols: scanResult.totalSymbols || 0,
    durationMs: scanResult.durationMs || 0,
    source: scanResult.source || 'binance_spot_1d',
  };

  const html = renderReportHtml({ meta, charts });
  ensureDir();
  const filePath = path.join(REPORT_DIR, file);
  fs.writeFileSync(filePath, html, 'utf8');

  const item = {
    id,
    file,
    scannedAt,
    trigger: meta.trigger,
    coinCount: n,
    topRatio,
    avgRatio,
    params: meta.params,
    totalSymbols: meta.totalSymbols,
    durationMs: meta.durationMs,
    urlPath: absoluteReportUrl(file),
  };

  const index = loadIndex();
  index.items = [item, ...index.items.filter((x) => x.file !== file)].slice(0, MAX_HISTORY);
  saveIndex(index);
  pruneHistory();
  return item;
}

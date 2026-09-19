import { icon } from '../utils/icons.js';
import { escapeHtml, formatNumber } from '../utils/format.js';

/** 字段中文名 */
const LABELS = {
  symbol: '交易对',
  instId: '合约',
  inst_id: '合约',
  exchange: '交易所',
  side: '方向',
  posSide: '方向',
  pos_side: '方向',
  direction: '方向',
  entry: '入场价',
  entry_price: '入场价',
  entryPrice: '入场价',
  open: '开仓价',
  open_price: '开仓价',
  openAvgPx: '开仓均价',
  open_avg_px: '开仓均价',
  avgPx: '均价',
  target: '目标价',
  take_profit: '止盈',
  tp: '止盈',
  stop: '止损',
  stop_loss: '止损',
  sl: '止损',
  mark: '标记价',
  markPx: '标记价',
  size: '数量',
  qty: '数量',
  amount: '金额',
  lever: '杠杆',
  leverage: '杠杆',
  margin: '保证金',
  pnl: '盈亏',
  upl: '浮盈',
  uplRatio: '浮盈率',
  pnlRatio: '盈亏率',
  price: '价格',
  last: '最新价',
  high_24h: '24h 最高',
  low_24h: '24h 最低',
  volume_24h: '24h 量',
  change_24h: '24h 涨跌',
  note: '备注',
  reason: '逻辑',
  plan: '计划',
  date: '日期',
  time: '时间',
};

const SIDE_MAP = { long: '多', short: '空', buy: '买入', sell: '卖出', '做多': '多', '做空': '空' };

function labelOf(key) {
  return LABELS[key] || key;
}

function fmtVal(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number' && Number.isFinite(v)) {
    const abs = Math.abs(v);
    if (abs >= 1000) return formatNumber(v, abs >= 100000 ? 0 : 2);
    if (abs >= 1) return formatNumber(v, 2);
    if (abs > 0) return formatNumber(v, 6);
    return String(v);
  }
  if (typeof v === 'boolean') return v ? '是' : '否';
  return String(v);
}

function isPriceKey(k) {
  return /price|px|entry|target|stop|open|close|mark|high|low|last|avg/i.test(k);
}

function isPctKey(k) {
  return /ratio|pct|percent|change/i.test(k);
}

function priceTone(key, v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (/stop|sl|low/i.test(key)) return '';
  if (isPctKey(key) || /pnl|upl|profit|change/i.test(key)) {
    return n > 0 ? 'up' : n < 0 ? 'down' : '';
  }
  return '';
}

/** 把 trade_data 对象渲染成可视化卡片 HTML */
export function renderTradeDataCard(td) {
  if (!td || typeof td !== 'object') return '';
  const keys = Object.keys(td);
  if (!keys.length) return '';

  const used = new Set();
  const sections = [];

  // 1) 交易计划摘要（常见字段）
  const planOrder = [
    'symbol', 'instId', 'exchange', 'side', 'direction',
    'entry', 'entry_price', 'entryPrice', 'open', 'open_price', 'openAvgPx',
    'target', 'take_profit', 'tp',
    'stop', 'stop_loss', 'sl',
    'size', 'qty', 'amount', 'lever', 'leverage', 'margin',
    'pnl', 'upl', 'note', 'reason', 'plan',
  ];
  const planKeys = planOrder.filter((k) => k in td && td[k] != null && td[k] !== '');
  planKeys.forEach((k) => used.add(k));

  if (planKeys.length) {
    const chips = planKeys.map((k) => {
      let raw = td[k];
      let val = fmtVal(raw);
      if (k === 'side' || k === 'direction' || k === 'posSide' || k === 'pos_side') {
        val = SIDE_MAP[String(raw).toLowerCase()] || String(raw);
      }
      if (k === 'lever' || k === 'leverage') val = `${raw}x`;
      const tone = priceTone(k, raw);
      const unit = isPctKey(k) && Number.isFinite(Number(raw)) ? '%' : '';
      return `
        <div class="td-chip">
          <span class="td-k">${escapeHtml(labelOf(k))}</span>
          <span class="td-v mono ${tone}">${escapeHtml(val)}${unit}</span>
        </div>
      `;
    }).join('');

    // 止盈止损可视化条
    let rangeBar = '';
    const entry = Number(td.entry ?? td.entry_price ?? td.entryPrice ?? td.open);
    const target = Number(td.target ?? td.take_profit ?? td.tp);
    const stop = Number(td.stop ?? td.stop_loss ?? td.sl);
    if (Number.isFinite(entry) && entry > 0 && (Number.isFinite(target) || Number.isFinite(stop))) {
      const t = Number.isFinite(target) ? target : entry;
      const s = Number.isFinite(stop) ? stop : entry;
      const lo = Math.min(s, entry, t);
      const hi = Math.max(s, entry, t);
      const span = hi - lo || 1;
      const pos = (x) => ((x - lo) / span) * 100;
      const win = t >= entry;
      rangeBar = `
        <div class="td-range" title="止损 · 入场 · 止盈">
          <div class="td-range-track">
            <span class="td-range-stop" style="left:${pos(s)}%"></span>
            <span class="td-range-entry" style="left:${pos(entry)}%"></span>
            <span class="td-range-target ${win ? 'up' : 'down'}" style="left:${pos(t)}%"></span>
          </div>
          <div class="td-range-labels">
            <span class="down">止损 ${escapeHtml(fmtVal(s))}</span>
            <span>入场 ${escapeHtml(fmtVal(entry))}</span>
            <span class="${win ? 'up' : 'down'}">止盈 ${escapeHtml(fmtVal(t))}</span>
          </div>
        </div>
      `;
    }

    sections.push(`
      <div class="td-plan">
        <div class="td-chips">${chips}</div>
        ${rangeBar}
      </div>
    `);
  }

  // 2) ticker / 行情对象（兼容 OKX last/high24h 与 last/high_24h）
  for (const [k, v] of Object.entries(td)) {
    if (used.has(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && (v.price || v.last || v.high_24h || v.high24h || v.open24h)) {
      used.add(k);
      const price = v.last ?? v.price;
      const high = v.high_24h ?? v.high24h;
      const low = v.low_24h ?? v.low24h;
      const vol = v.volume_24h ?? v.vol24h;
      const open = v.open_24h ?? v.open24h;
      let change = v.change_24h;
      if (change == null && Number.isFinite(Number(open)) && Number.isFinite(Number(price)) && Number(open) > 0) {
        change = `${(((Number(price) - Number(open)) / Number(open)) * 100).toFixed(2)}%`;
      }
      sections.push(`
        <div class="td-block">
          <div class="td-hdr">${icon('trend', 15)} ${escapeHtml(k === 'ticker' ? '行情快照' : labelOf(k))}</div>
          <div class="td-price-row">
            <strong class="mono">${escapeHtml(fmtVal(price))}</strong>
            ${change != null ? `<span class="${Number(String(change).replace('%', '')) >= 0 ? 'up' : 'down'}">${escapeHtml(String(change))}</span>` : ''}
          </div>
          <div class="td-mini-grid">
            ${high != null ? miniStat('24h 高', high, 'up') : ''}
            ${low != null ? miniStat('24h 低', low, 'down') : ''}
            ${open != null ? miniStat('24h 开', open, '') : ''}
            ${vol != null ? miniStat('24h 量', vol, '') : ''}
          </div>
        </div>
      `);
    }
  }

  // 3) positions 数组
  for (const [k, v] of Object.entries(td)) {
    if (used.has(k)) continue;
    if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && (v[0].instId || v[0].inst_id || v[0].posSide || v[0].side)) {
      used.add(k);
      sections.push(`
        <div class="td-block">
          <div class="td-hdr">${icon('portfolio', 15)} 持仓</div>
          ${v.slice(0, 8).map((p) => posLine(p)).join('')}
        </div>
      `);
    }
  }

  // 4) 其余字段：键值对（非原始 JSON dump）
  const rest = keys.filter((k) => !used.has(k));
  if (rest.length) {
    sections.push(`
      <div class="td-block">
        <div class="td-hdr">${icon('spark', 15)} 其他信息</div>
        <div class="td-kv">
          ${rest.map((k) => {
            let v = td[k];
            let text;
            if (v && typeof v === 'object') {
              // 嵌套对象：尝试扁平化一行
              text = flattenOneLine(v);
            } else {
              text = fmtVal(v);
            }
            const tone = priceTone(k, v);
            return `<div class="td-kv-row">
              <span class="td-k">${escapeHtml(labelOf(k))}</span>
              <span class="td-v mono ${tone}">${escapeHtml(text)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `);
  }

  return `
    <section class="trade-data-card">
      <div class="td-title">${icon('chart', 16)} 交易数据</div>
      ${sections.join('')}
    </section>
  `;
}

function miniStat(label, val, tone) {
  return `<div class="td-mini"><span>${escapeHtml(label)}</span><strong class="mono ${tone}">${escapeHtml(fmtVal(val))}</strong></div>`;
}

function posLine(p) {
  const inst = (p.instId || p.inst_id || p.symbol || '—').toString().replace('-USDT-SWAP', '');
  const side = p.posSide || p.pos_side || p.side || '';
  const sideLabel = SIDE_MAP[String(side).toLowerCase()] || side || '—';
  const isShort = /short|空|sell/i.test(String(side));
  const lever = p.lever || p.leverage;
  const upl = p.upl ?? p.pnl;
  return `
    <div class="td-pos">
      <span class="td-pos-inst mono">${escapeHtml(inst)}</span>
      <span class="td-pos-side ${isShort ? 'down' : 'up'}">${escapeHtml(sideLabel)}</span>
      ${lever ? `<span class="td-pos-lever">${escapeHtml(String(lever))}x</span>` : ''}
      <span class="td-pos-px mono">${escapeHtml(fmtVal(p.avgPx || p.openAvgPx || p.open_avg_px))}</span>
      <span class="td-pos-upl mono ${Number(upl) >= 0 ? 'up' : 'down'}">${Number(upl) >= 0 ? '+' : ''}${escapeHtml(fmtVal(upl))}</span>
    </div>
  `;
}

function flattenOneLine(obj, depth = 0) {
  if (depth > 1) return '{…}';
  const parts = Object.entries(obj).slice(0, 6).map(([k, v]) => {
    if (v && typeof v === 'object') return `${k}=${flattenOneLine(v, depth + 1)}`;
    return `${k}=${fmtVal(v)}`;
  });
  return parts.join(' · ');
}

/**
 * 交易所矢量图标 — 对照官方标识重绘
 * OKX: 黑底 + 5 个白色圆角方块（四角 + 中心）
 * Binance: 深灰底 + 金黄菱形组（上/下大菱 + 左右小菱 + 中心）
 * 统一: 黑底 + 双环
 */

function wrap(inner, { size = 48, title = '' } = {}) {
  return `<svg class="ex-icon" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">${inner}</svg>`;
}

/** OKX：官方五方块 */
function okxInner() {
  const s = 11.5;
  const r = 3.2;
  const w = '#FFFFFF';
  // 布局：四角 + 中心（对齐官方）
  const cells = [
    [7.5, 7.5],
    [29, 7.5],
    [18.25, 18.25],
    [7.5, 29],
    [29, 29],
  ];
  const rects = cells
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" fill="${w}"/>`)
    .join('');
  return `
    <rect width="48" height="48" rx="10" fill="#000000"/>
    ${rects}
  `;
}

/** Binance：官方菱形组（无字标，适配小尺寸） */
function binanceInner() {
  const gold = '#F0B90B';
  // 旋转 45° 的正方形 = 菱形
  // cx, cy, half-diagonal
  const dia = (cx, cy, d) =>
    `<path d="M${cx} ${cy - d} L${cx + d} ${cy} L${cx} ${cy + d} L${cx - d} ${cy} Z" fill="${gold}"/>`;

  return `
    <rect width="48" height="48" rx="10" fill="#1E2329"/>
    <!-- 上菱（大） -->
    ${dia(24, 12.8, 7.8)}
    <!-- 左菱 -->
    ${dia(10.2, 24, 5.4)}
    <!-- 右菱 -->
    ${dia(37.8, 24, 5.4)}
    <!-- 下菱（大） -->
    ${dia(24, 35.2, 7.8)}
    <!-- 中心菱 -->
    ${dia(24, 24, 5.4)}
  `;
}

/** 统一视图 */
function unifiedInner() {
  return `
    <rect width="48" height="48" rx="10" fill="#0B0B0F"/>
    <circle cx="17.5" cy="24" r="9" stroke="#FFFFFF" stroke-width="2.4" fill="none"/>
    <circle cx="30.5" cy="24" r="9" stroke="#F0B90B" stroke-width="2.4" fill="none"/>
    <circle cx="24" cy="24" r="2.8" fill="#5AC8FA"/>
  `;
}

const ICONS = {
  okx: { title: 'OKX', draw: okxInner },
  binance: { title: 'Binance', draw: binanceInner },
  bn: { title: 'Binance', draw: binanceInner },
  unified: { title: '统一', draw: unifiedInner },
};

export function exchangeIcon(exchange, size = 48) {
  const key = String(exchange || '').toLowerCase();
  const meta = ICONS[key] || ICONS.okx;
  return wrap(meta.draw(), { size, title: meta.title });
}

export function exchangeLabel(exchange) {
  const map = { okx: 'OKX', binance: 'Binance', bn: 'Binance', unified: '统一' };
  return map[String(exchange || '').toLowerCase()] || String(exchange || '');
}

import { icon } from '../utils/icons.js';
import { escapeHtml, formatTime } from '../utils/format.js';
import { exchangeIcon, exchangeLabel } from './exchange-icons.js';

export function renderBlogCard(post, index = 0, featured = false) {
  let tags = [];
  try {
    tags = JSON.parse(post.tags || '[]');
  } catch { tags = []; }
  if (!Array.isArray(tags)) tags = [];

  return `
    <a href="#/blog/${post.id}" class="blog-card ${featured ? 'featured' : ''} reveal" style="--reveal-delay:${index * 80}ms">
      <div class="blog-card-tags">
        ${tags.slice(0, 3).map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}
      </div>
      <h3 class="blog-card-title">${escapeHtml(post.title)}</h3>
      <p class="blog-card-summary">${escapeHtml(post.summary || '')}</p>
      <div class="blog-card-footer">
        <span>${formatTime(post.created_at)}</span>
        <span class="read-more">阅读 ${icon('arrow', 14)}</span>
      </div>
    </a>
  `;
}

export function renderExchangeBadge(exchange, opts = {}) {
  const key = String(exchange || '').toLowerCase();
  const label = opts.text || (key === 'bn' ? 'BNB' : exchangeLabel(exchange));
  const cls = key === 'binance' || key === 'bn' ? 'binance' : key === 'unified' ? 'unified' : 'okx';
  const showIcon = opts.icon !== false;
  return `<span class="exchange-badge ${cls}">${showIcon ? exchangeIcon(key === 'bn' ? 'binance' : key, opts.iconSize || 14) : ''}<span>${escapeHtml(label)}</span></span>`;
}

export function renderToggle(checked, id, label = '') {
  return `
    <label class="toggle-switch" title="${escapeHtml(label)}">
      <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} />
      <span class="track"></span>
    </label>
  `;
}

export function renderCrystal(value, mode = 'single', showUnified = true) {
  const options = showUnified
    ? [
        { key: 'okx', label: 'OKX' },
        { key: 'binance', label: 'Binance' },
        { key: 'unified', label: '统一' },
      ]
    : [
        { key: 'okx', label: 'OKX' },
        { key: 'binance', label: 'Binance' },
      ];

  function isActive(key) {
    if (mode === 'single') return value === key;
    const arr = Array.isArray(value) ? value : [];
    if (key === 'unified') return arr.includes('okx') && arr.includes('binance');
    return arr.includes(key);
  }

  return `
    <div class="crystal-core" data-mode="${mode}">
      <div class="crystal-nodes">
        <div class="crystal-vein"><div class="vein-line"></div></div>
        ${options.map((o) => `
          <button type="button" class="crystal-node ${o.key} ${isActive(o.key) ? 'active' : ''}" data-key="${o.key}">
            <span class="node-gem">${exchangeIcon(o.key, 44)}</span>
            <span class="node-label">${o.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/** Bind crystal click handlers; onChange(newValue) */
export function bindCrystal(el, value, mode, onChange) {
  el.querySelectorAll('.crystal-node').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (mode === 'single') {
        onChange(key);
      } else {
        let arr = Array.isArray(value) ? [...value] : [];
        if (key === 'unified') {
          const both = arr.includes('okx') && arr.includes('binance');
          arr = both ? [] : ['okx', 'binance'];
        } else {
          const i = arr.indexOf(key);
          if (i >= 0) arr.splice(i, 1);
          else arr.push(key);
        }
        onChange(arr);
      }
    });
  });
}

import { icon } from '../utils/icons.js';
import { FOOTER_TAGLINES } from '../data/footer-taglines.js';

export function mountFooter() {
  const el = document.getElementById('app-footer');
  if (!el) return;
  const tagline = FOOTER_TAGLINES[Math.floor(Math.random() * FOOTER_TAGLINES.length)];
  const year = new Date().getFullYear();
  el.className = 'app-footer';
  el.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <span class="footer-logo">${icon('logo', 18)} 投资日志</span>
        <span class="footer-tagline">${tagline}</span>
      </div>
      <span class="footer-copy">&copy; ${year} — 数据自有，思想自由</span>
    </div>
  `;
}

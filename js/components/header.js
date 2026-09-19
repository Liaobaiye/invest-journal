import { icon } from '../utils/icons.js';
import { authState, isAuthenticated } from '../store.js';
import api from '../api.js';

const NAV = [
  { hash: '#/', label: '首页', icon: 'home' },
  { hash: '#/blog', label: '博客', icon: 'blog' },
  { hash: '#/portfolio', label: '组合', icon: 'portfolio' },
  { hash: '#/alerts', label: '提醒', icon: 'alerts' },
  { hash: '#/altcoin', label: '山寨币', icon: 'trend' },
];

export function mountHeader() {
  const el = document.getElementById('app-header');
  if (!el) return;

  function render() {
    const auth = authState.get();
    const loggedIn = isAuthenticated();
    el.innerHTML = `
      <div class="app-header" id="header-bar">
        <div class="header-inner">
          <a href="#/" class="logo">
            <span class="logo-icon">${icon('logo', 24)}</span>
            <span class="logo-text">投资日志</span>
          </a>
          <nav class="nav-links">
            ${NAV.map((n) => `
              <a href="${n.hash}" data-hash="${n.hash}">
                <span class="nav-icon">${icon(n.icon, 18)}</span>
                <span>${n.label}</span>
                <span class="nav-ink" aria-hidden="true"></span>
              </a>
            `).join('')}
            ${loggedIn
              ? `<span class="user-dot"></span>
                 <span class="user-tag">${auth.user?.username || ''}</span>
                 <a href="#" class="nav-logout" id="btn-logout">退出</a>`
              : `<a href="#/login" class="nav-login" data-hash="#/login">
                   <span class="nav-icon">${icon('login', 18)}</span>登录
                 </a>`}
          </nav>
        </div>
      </div>
    `;

    el.querySelector('#btn-logout')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await api.logout();
      render();
      window.location.hash = '#/';
    });
  }

  render();
  authState.subscribe(render);

  window.addEventListener('scroll', () => {
    el.querySelector('.app-header')?.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

import api from '../api.js';
import { icon } from '../utils/icons.js';
import { escapeHtml } from '../utils/format.js';

export async function LoginPage(main, { query }) {
  main.innerHTML = `
    <div class="login-page">
      <div class="login-shell">
        <div class="login-brand">
          <div class="brand-glow"></div>
          <span class="brand-logo">${icon('logo', 36)}</span>
          <span class="brand-kicker">MYWEB · INVESTMENT JOURNAL</span>
          <h1 class="brand-title">投资日志<br><span>管理台</span></h1>
          <ul class="brand-features">
            <li>${icon('shield', 18)}<span>JWT 双令牌鉴权</span></li>
            <li>${icon('coins', 18)}<span>交易所密钥加密存储</span></li>
            <li>${icon('chart', 18)}<span>仓位与告警统一管理</span></li>
          </ul>
        </div>
        <div class="login-form-panel">
          <span class="form-kicker">ADMIN CONSOLE</span>
          <h2>登录</h2>
          <form id="login-form">
            <div id="login-error"></div>
            <div class="form-group">
              <label>用户名</label>
              <input class="form-input" name="username" required autocomplete="username" />
            </div>
            <div class="form-group">
              <label>密码</label>
              <input class="form-input" name="password" type="password" required autocomplete="current-password" />
            </div>
            <button type="submit" class="btn-primary login-submit" id="login-btn">登录</button>
          </form>
          <p class="login-hint muted">默认账号见 README / 种子脚本</p>
        </div>
      </div>
    </div>
  `;

  main.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = main.querySelector('#login-btn');
    const err = main.querySelector('#login-error');
    btn.disabled = true;
    err.innerHTML = '';
    const fd = new FormData(e.target);
    try {
      await api.login(String(fd.get('username')), String(fd.get('password')));
      const redirect = query.redirect || '#/';
      window.location.hash = redirect.startsWith('#') ? redirect : '#' + redirect;
    } catch (ex) {
      err.innerHTML = `<div class="error-banner">${escapeHtml(ex.message || '登录失败')}</div>`;
    } finally {
      btn.disabled = false;
    }
  });
}

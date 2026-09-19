import { route, setNotFound, startRouter } from './router.js';
import { mountHeader } from './components/header.js';
import { mountFooter } from './components/footer.js';
import { mountThemeToggle } from './components/theme-toggle.js';
import { mountDailyQuote } from './components/daily-quote.js';
import { initConfirmDialog, startBgShapes } from './utils/motion.js';
import { safePage } from './utils/safePage.js';
import api from './api.js';

import { HomePage } from './pages/home.js';
import { BlogPage } from './pages/blog.js';
import { BlogDetailPage } from './pages/blog-detail.js';
import { BlogEditorPage } from './pages/blog-editor.js';
import { PortfolioPage } from './pages/portfolio.js';
import { AlertsPage } from './pages/alerts.js';
import { AltcoinPage } from './pages/altcoin.js';
import { SettingsPage } from './pages/settings.js';
import { LoginPage } from './pages/login.js';

function boot() {
  mountHeader();
  mountFooter();
  mountThemeToggle();
  initConfirmDialog();
  mountDailyQuote();
  startBgShapes();

  // safePage：单页异常只影响 #app-main，不拖垮壳与其他功能
  route('/', { component: safePage(HomePage, 'home'), title: '首页' });
  route('/blog', { component: safePage(BlogPage, 'blog'), title: '博客' });
  route('/blog/new', { component: safePage(BlogEditorPage, 'editor-new'), requiresAuth: true, title: '写文章' });
  route('/blog/:id', { component: safePage(BlogDetailPage, 'blog-detail'), title: '文章' });
  route('/blog/:id/edit', { component: safePage(BlogEditorPage, 'editor-edit'), requiresAuth: true, title: '编辑' });
  route('/portfolio', { component: safePage(PortfolioPage, 'portfolio'), title: '组合' });
  route('/alerts', { component: safePage(AlertsPage, 'alerts'), title: '提醒' });
  route('/altcoin', { component: safePage(AltcoinPage, 'altcoin'), title: '山寨币监测' });
  // 旧链接兼容：稳定币监测已并入提醒页
  route('/stablecoins', {
    component: async () => { window.location.hash = '#/alerts'; },
    title: '稳定币',
  });
  route('/settings', { component: safePage(SettingsPage, 'settings'), requiresAuth: true, title: '设置' });
  route('/login', { component: safePage(LoginPage, 'login'), title: '登录' });

  setNotFound(async (main) => {
    main.innerHTML = `<div class="empty-state"><p>页面不存在</p><a href="#/">返回首页</a></div>`;
  });

  startRouter();

  if (localStorage.getItem('accessToken')) {
    api.check().catch(() => {});
  }

  window.addEventListener('demo-mode', (e) => {
    let banner = document.getElementById('demo-banner');
    if (e.detail.demo) {
      const text =
        e.detail.source === 'market'
          ? '行情接口暂不可用（需代理）· 展示示例数据'
          : '后端未连接 · 部分数据为示例';
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'demo-banner';
        banner.className = 'demo-banner';
        document.body.appendChild(banner);
      }
      banner.textContent = text;
    } else if (banner) {
      banner.remove();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

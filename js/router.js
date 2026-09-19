/** Hash router */
const routes = [];
let currentCleanup = null;
let notFound = null;
/** 并发导航序号：快速切页时丢弃过期的 render */
let renderSeq = 0;
/** 当前导航的 AbortController，快速切页时 abort 旧页 */
let renderAbort = null;

export function route(path, { component, requiresAuth = false, title } = {}) {
  routes.push({ path, component, requiresAuth, title, pattern: compile(path) });
}

export function setNotFound(fn) {
  notFound = fn;
}

function compile(path) {
  const keys = [];
  const re = path
    .replace(/\/+$/, '')
    .replace(/:([A-Za-z_]+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });
  return { re: new RegExp(`^${re || '/'}$`), keys };
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [pathname, search = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  return { pathname: pathname || '/', query, raw };
}

function match(pathname) {
  for (const r of routes) {
    const m = r.pattern.re.exec(pathname.replace(/\/+$/, '') || '/');
    if (!m) continue;
    const params = {};
    r.pattern.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    return { route: r, params };
  }
  return null;
}

/** 导航高亮：与页面内容加载解耦，切页立即更新 */
function highlightNav(pathname) {
  document.querySelectorAll('.nav-links a[data-hash]').forEach((a) => {
    const path = (a.getAttribute('data-hash') || '').replace(/^#/, '');
    if (!path) return;
    const isActive = path === '/'
      ? pathname === '/'
      : pathname === path || pathname.startsWith(path + '/');
    a.classList.toggle('active', isActive);
  });
}

async function render() {
  const seq = ++renderSeq;
  // abort 上一次未完成的页面，避免其异步回调写已卸载 DOM
  if (renderAbort) renderAbort.abort();
  renderAbort = new AbortController();
  const signal = renderAbort.signal;

  const { pathname, query } = parseHash();
  const matched = match(pathname);
  const main = document.getElementById('app-main');
  if (!main) return;

  // 标记本代渲染，页面可据此判断是否仍有效
  main.__pageGen = seq;

  // 高亮先做，避免等页面数据导致顶栏卡顿
  highlightNav(pathname);

  if (currentCleanup) {
    try { currentCleanup(); } catch { /* ignore */ }
    currentCleanup = null;
  }

  // Auth guard
  if (matched?.route.requiresAuth && !localStorage.getItem('accessToken')) {
    window.location.hash = `#/login?redirect=${encodeURIComponent('#' + pathname)}`;
    return;
  }

  main.classList.remove('page-fade');
  void main.offsetWidth;
  main.classList.add('page-fade');

  try {
    if (matched) {
      document.title = matched.route.title
        ? `${matched.route.title} · 投资日志`
        : '投资日志';
      const result = await matched.route.component(main, {
        params: matched.params,
        query,
        signal,
        alive: () => seq === renderSeq && !signal.aborted,
      });
      if (seq !== renderSeq || signal.aborted) return;
      if (typeof result === 'function') currentCleanup = result;
    } else if (notFound) {
      const result = await notFound(main, { params: {}, query, signal });
      if (seq !== renderSeq || signal.aborted) return;
      if (typeof result === 'function') currentCleanup = result;
    } else {
      if (seq !== renderSeq) return;
      main.innerHTML = '<div class="empty-state"><p>页面不存在</p><a href="#/">返回首页</a></div>';
    }
  } catch (err) {
    if (seq !== renderSeq || signal.aborted) return;
    console.error('[router]', err);
    main.innerHTML = `<div class="empty-state"><p>页面加载失败</p><a href="#/">返回首页</a></div>`;
  }
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

export function navigate(hash) {
  if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

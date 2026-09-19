import api from '../api.js';
import { icon } from '../utils/icons.js';
import { applyReveal } from '../utils/motion.js';
import { renderBlogCard } from '../components/shared.js';
import { isAuthenticated } from '../store.js';
import { escapeHtml } from '../utils/format.js';

export async function BlogPage(main, { query }) {
  const page = Number(query.page) || 1;
  const tag = query.tag || '';

  main.innerHTML = `
    <div class="blog-page">
      <div class="page-header">
        <h1>博客</h1>
        ${isAuthenticated() ? `<a href="#/blog/new" class="btn-primary">${icon('write', 16)} 写文章</a>` : ''}
      </div>
      <section class="tag-panel glass-card" aria-label="标签筛选">
        <div class="tag-panel-head">
          <span class="tag-panel-title">${icon('blog', 14)} 标签</span>
          <span class="muted" id="tag-hint"></span>
        </div>
        <div class="tag-rail" id="tag-rail"></div>
      </section>
      <div class="post-grid blog-post-grid" id="blog-posts">
        <div class="loading-state"><span class="loading-spinner"></span> 加载中...</div>
      </div>
      <div class="pagination" id="blog-pagination"></div>
    </div>
  `;

  applyReveal(main);
  await load(main, page, tag);
}

async function load(main, page, tag) {
  const el = main.querySelector('#blog-posts');
  const pag = main.querySelector('#blog-pagination');
  const rail = main.querySelector('#tag-rail');
  try {
    // 标签栏始终基于全量文章汇总，避免按当前筛选结果重排/丢标签
    const [data, allTags] = await Promise.all([
      api.listPosts({ page, limit: 10, tag }),
      loadAllTags(),
    ]);
    const posts = data.posts || [];
    const pagination = data.pagination || { page: 1, totalPages: 1, total: 0 };

    const tagList = [...allTags];
    if (tag && !tagList.includes(tag)) tagList.unshift(tag);

    rail.innerHTML = [
      `<button class="tag-chip ${!tag ? 'active' : ''}" data-tag="">全部</button>`,
      ...tagList.slice(0, 12).map((t) =>
        `<button class="tag-chip ${tag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
      ),
    ].join('');

    const hint = main.querySelector('#tag-hint');
    if (hint) {
      hint.textContent = tag ? `筛选：${tag}` : `共 ${tagList.length} 个标签`;
    }

    rail.querySelectorAll('.tag-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tag;
        window.location.hash = t ? `#/blog?tag=${encodeURIComponent(t)}` : '#/blog';
      });
    });

    if (!posts.length) {
      el.innerHTML = `<div class="empty-state">${icon('blog', 42)}<p>暂无文章</p></div>`;
      pag.innerHTML = '';
      return;
    }

    el.innerHTML = posts
      .map((p, i) => renderBlogCard(p, i, i === 0 && !tag && posts.length > 1))
      .join('');
    applyReveal(el);

    const { totalPages } = pagination;
    pag.innerHTML = `
      <button class="btn-ghost" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">上一页</button>
      <span class="page-info mono">${page} / ${totalPages}</span>
      <button class="btn-ghost" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">下一页</button>
    `;
    pag.querySelectorAll('button[data-page]').forEach((b) => {
      b.addEventListener('click', () => {
        const p = Number(b.dataset.page);
        if (p < 1 || p > totalPages) return;
        const q = new URLSearchParams({ page: String(p) });
        if (tag) q.set('tag', tag);
        window.location.hash = `#/blog?${q}`;
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><p>加载失败：${e.message}</p></div>`;
  }
}

/** 全量文章标签，按出现次数降序 + 名称排序，保证切换筛选时顺序稳定 */
async function loadAllTags() {
  try {
    const data = await api.listPosts({ page: 1, limit: 100, tag: '' });
    const counts = new Map();
    (data.posts || []).forEach((p) => {
      try {
        const t = JSON.parse(p.tags || '[]');
        if (Array.isArray(t)) t.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
      } catch { /* ignore */ }
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh'))
      .map(([t]) => t);
  } catch {
    return [];
  }
}

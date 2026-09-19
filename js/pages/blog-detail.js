import api from '../api.js';
import { icon } from '../utils/icons.js';
import { escapeHtml, formatTime } from '../utils/format.js';
import { renderMarkdown } from '../utils/markdown.js';
import { showConfirm, applyReveal } from '../utils/motion.js';
import { isAuthenticated } from '../store.js';
import { renderTradeDataCard } from '../components/trade-data-card.js';

export async function BlogDetailPage(main, { params }) {
  main.innerHTML = `<div class="loading-state"><span class="loading-spinner"></span> 加载中...</div>`;

  let post;
  try {
    post = await api.getPost(params.id);
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><p>${e.status === 404 ? '文章不存在' : '加载失败'}</p><a href="#/blog">返回博客</a></div>`;
    return;
  }

  let tags = [];
  try { tags = JSON.parse(post.tags || '[]'); } catch { tags = []; }
  if (!Array.isArray(tags)) tags = [];

  let trade = null;
  try {
    const td = typeof post.trade_data === 'string' ? JSON.parse(post.trade_data || '{}') : post.trade_data;
    trade = td && Object.keys(td).length ? td : null;
  } catch { trade = null; }

  const readMin = Math.max(1, Math.round((post.content || '').length / 400));
  const authed = isAuthenticated();

  main.innerHTML = `
    <div class="blog-detail" id="blog-detail">
      <div class="read-progress" id="read-progress"></div>
      <a href="#/blog" class="back-link">← 返回博客</a>
      <header class="detail-header">
        ${tags.length ? `<div class="detail-tags">${tags.map((t) => `<a class="tag-chip" href="#/blog?tag=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join('')}</div>` : ''}
        <h1>${escapeHtml(post.title)}</h1>
        <div class="detail-meta">
          <span>${formatTime(post.created_at)}</span>
          <span>·</span>
          <span>约 ${readMin} 分钟阅读</span>
          ${post.is_published === 0 ? '<span class="draft-pill">草稿</span>' : ''}
        </div>
      </header>
      <article class="detail-body markdown-body">${renderMarkdown(post.content)}</article>
      ${trade ? renderTradeDataCard(trade) : ''}
      ${authed ? `
        <div class="detail-actions">
          <a href="#/blog/${post.id}/edit" class="btn-ghost">${icon('write', 15)} 编辑</a>
          <button type="button" class="btn-ghost ai-btn" id="btn-ai-comment">${icon('spark', 15)} AI 评论</button>
          <button type="button" class="btn-danger" id="btn-delete">${icon('close', 15)} 删除</button>
        </div>
      ` : ''}
      <div class="comment-section" id="comment-section"></div>
    </div>
  `;

  applyReveal(main);
  bindProgress(main);
  bindActions(main, post);
  await renderComments(main.querySelector('#comment-section'), post.id);
}

function bindProgress(main) {
  const bar = main.querySelector('#read-progress');
  if (!bar) return;
  const onScroll = () => {
    const doc = document.documentElement;
    const h = doc.scrollHeight - doc.clientHeight;
    const p = h > 0 ? (window.scrollY / h) * 100 : 0;
    bar.style.width = `${p}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return () => window.removeEventListener('scroll', onScroll);
}

function bindActions(main, post) {
  main.querySelector('#btn-delete')?.addEventListener('click', async () => {
    if (!(await showConfirm('删除文章', `确定删除「${post.title}」吗？此操作不可恢复。`))) return;
    try {
      await api.deletePost(post.id);
      window.location.hash = '#/blog';
    } catch (e) {
      alert('删除失败：' + e.message);
    }
  });
  main.querySelector('#btn-ai-comment')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api.aiComment(post.id);
      await renderComments(main.querySelector('#comment-section'), post.id);
    } catch (err) {
      alert('AI 评论失败：' + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

async function renderComments(el, postId) {
  if (!el) return;
  el.innerHTML = `
    <h3 class="section-title">评论</h3>
    <form class="comment-form" id="comment-form">
      <div class="comment-form-row">
        <input class="form-input" name="author_name" placeholder="昵称" required maxlength="40" />
        <button type="submit" class="btn-primary">发表</button>
      </div>
      <textarea class="form-textarea" name="content" placeholder="写下你的想法..." required maxlength="2000"></textarea>
    </form>
    <div class="comment-list" id="comment-list"><div class="loading-state"><span class="loading-spinner"></span></div></div>
  `;

  const list = el.querySelector('#comment-list');
  let comments = [];
  try {
    comments = await api.listComments(postId);
  } catch {
    list.innerHTML = '<div class="empty-state"><p>评论加载失败</p></div>';
  }

  function paint() {
    if (!comments.length) {
      list.innerHTML = '<div class="empty-state"><p>还没有评论，来抢沙发</p></div>';
      return;
    }
    const roots = comments.filter((c) => !c.parent_id);
    const children = comments.filter((c) => c.parent_id);
    list.innerHTML = roots.map((c) => {
      const replies = children.filter((r) => r.parent_id === c.id);
      return `
        <div class="comment-item ${c.is_ai ? 'is-ai' : ''}" data-id="${c.id}">
          <div class="comment-head">
            <strong>${escapeHtml(c.author_name)}</strong>
            ${c.is_ai ? '<span class="ai-pill">AI</span>' : ''}
            <span class="muted">${formatTime(c.created_at)}</span>
            ${isAuthenticated() ? `<button type="button" class="comment-del" data-del="${c.id}">×</button>` : ''}
          </div>
          <p class="comment-body">${escapeHtml(c.content)}</p>
          <button type="button" class="reply-btn" data-reply="${c.id}">回复</button>
          <div class="reply-form-slot" data-slot="${c.id}"></div>
          ${replies.length ? `<div class="comment-replies">${replies.map((r) => `
            <div class="comment-item ${r.is_ai ? 'is-ai' : ''}">
              <div class="comment-head">
                <strong>${escapeHtml(r.author_name)}</strong>
                ${r.is_ai ? '<span class="ai-pill">AI</span>' : ''}
                <span class="muted">${formatTime(r.created_at)}</span>
              </div>
              <p class="comment-body">${escapeHtml(r.content)}</p>
            </div>
          `).join('')}</div>` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!(await showConfirm('删除评论', '确定删除这条评论吗？'))) return;
        try {
          await api.deleteComment(Number(b.dataset.del));
          comments = await api.listComments(postId);
          paint();
        } catch (e) { alert(e.message); }
      });
    });

    list.querySelectorAll('[data-reply]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.reply;
        const slot = list.querySelector(`[data-slot="${id}"]`);
        if (!slot || slot.innerHTML) { slot.innerHTML = ''; return; }
        slot.innerHTML = `
          <form class="reply-form" data-parent="${id}">
            <input class="form-input" name="author_name" placeholder="昵称" required />
            <textarea class="form-textarea" name="content" placeholder="回复..." required rows="2"></textarea>
            <button type="submit" class="btn-primary">回复</button>
          </form>
        `;
        slot.querySelector('form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await api.createComment(postId, {
              author_name: fd.get('author_name'),
              content: fd.get('content'),
              parent_id: Number(id),
            });
            comments = await api.listComments(postId);
            paint();
          } catch (err) { alert(err.message); }
        });
      });
    });
  }

  paint();

  el.querySelector('#comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.createComment(postId, {
        author_name: fd.get('author_name'),
        content: fd.get('content'),
      });
      e.target.reset();
      comments = await api.listComments(postId);
      paint();
    } catch (err) { alert(err.message); }
  });
}

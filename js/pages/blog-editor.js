import api from '../api.js';
import { renderMarkdown } from '../utils/markdown.js';
import { renderCrystal } from '../components/shared.js';
import { escapeHtml } from '../utils/format.js';
import { icon } from '../utils/icons.js';

export async function BlogEditorPage(main, { params }) {
  const isEdit = !!params.id;
  let post = null;
  if (isEdit) {
    try { post = await api.getPost(params.id); }
    catch {
      main.innerHTML = `<div class="empty-state"><p>文章不存在</p><a href="#/blog">返回</a></div>`;
      return;
    }
  }

  let tags = '';
  try {
    const t = JSON.parse(post?.tags || '[]');
    tags = Array.isArray(t) ? t.join(', ') : '';
  } catch { tags = ''; }

  let tradeRaw = '';
  if (post?.trade_data && post.trade_data !== '{}') {
    tradeRaw = typeof post.trade_data === 'string' ? post.trade_data : JSON.stringify(post.trade_data);
  }

  let exchange = 'okx';

  main.innerHTML = `
    <div class="editor-page">
      <div class="page-header">
        <div>
          <span class="kicker">${isEdit ? 'EDIT POST' : 'NEW POST'}</span>
          <h1>${isEdit ? '编辑文章' : '写文章'}</h1>
        </div>
        <a href="${isEdit ? `#/blog/${params.id}` : '#/blog'}" class="btn-ghost">返回</a>
      </div>
      <div class="editor-workspace">
        <div class="editor-main glass-card">
          <div class="form-group">
            <label>标题</label>
            <input class="form-input" id="f-title" value="${escapeHtml(post?.title || '')}" maxlength="200" />
          </div>
          <div class="editor-meta-grid">
            <div class="form-group">
              <label>摘要</label>
              <textarea class="form-textarea" id="f-summary" rows="2" maxlength="300">${escapeHtml(post?.summary || '')}</textarea>
            </div>
            <div class="form-group">
              <label>标签（逗号分隔）</label>
              <input class="form-input" id="f-tags" value="${escapeHtml(tags)}" placeholder="BTC, 复盘" />
            </div>
          </div>
          <div class="form-group">
            <label>正文（Markdown）</label>
            <textarea class="form-textarea mono" id="f-content" rows="16">${escapeHtml(post?.content || '')}</textarea>
          </div>
          <div class="preview-box" id="preview-box"></div>
        </div>
        <aside class="editor-side">
          <div class="side-panel glass-card">
            <div class="panel-head">
              <span class="panel-icon">${icon('chart', 16)}</span>
              <span>交易数据</span>
            </div>
            <div id="crystal-slot"></div>
            <div class="fetch-actions">
              <button type="button" class="btn-ghost" data-fetch="ticker">行情</button>
              <button type="button" class="btn-ghost" data-fetch="clear">清空</button>
            </div>
            <pre class="trade-preview mono" id="trade-preview">${escapeHtml(tradeRaw)}</pre>
          </div>
          <div class="side-panel glass-card">
            <div class="panel-head">
              <span class="panel-icon">${icon('write', 16)}</span>
              <span>发布</span>
            </div>
            <div class="publish-actions">
              <button type="button" class="btn-ghost" id="btn-draft">存草稿</button>
              <button type="button" class="btn-primary" id="btn-publish">${isEdit ? '保存修改' : '发布'}</button>
            </div>
            <p class="hint">草稿仅管理员可见</p>
          </div>
        </aside>
      </div>
    </div>
  `;

  const crystalSlot = main.querySelector('#crystal-slot');
  function paintCrystal() {
    crystalSlot.innerHTML = renderCrystal(exchange, 'single', false);
    crystalSlot.querySelectorAll('.crystal-node').forEach((btn) => {
      btn.addEventListener('click', () => {
        exchange = btn.dataset.key;
        paintCrystal();
      });
    });
  }
  paintCrystal();

  const contentEl = main.querySelector('#f-content');
  const preview = main.querySelector('#preview-box');
  let previewTimer;
  contentEl.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const html = renderMarkdown(contentEl.value);
      preview.innerHTML = html
        ? `<label class="preview-label">预览</label><div class="markdown-body">${html}</div>`
        : '';
    }, 120);
  });

  const tradePreview = main.querySelector('#trade-preview');
  main.querySelectorAll('[data-fetch]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.fetch;
      if (kind === 'clear') {
        tradeRaw = '';
        tradePreview.textContent = '';
        return;
      }
      if (kind === 'ticker') {
        try {
          const t = await api.ticker('BTC-USDT', exchange);
          tradeRaw = JSON.stringify({ symbol: 'BTC-USDT', exchange, ticker: t }, null, 2);
          tradePreview.textContent = tradeRaw;
        } catch (e) {
          tradePreview.textContent = '获取失败: ' + e.message;
        }
      }
    });
  });

  function collect(published) {
    const title = main.querySelector('#f-title').value.trim();
    const content = contentEl.value;
    if (!title || !content) {
      alert('标题和正文不能为空');
      return null;
    }
    const tagStr = main.querySelector('#f-tags').value.trim();
    const tagList = tagStr ? tagStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : [];
    let trade = {};
    if (tradeRaw) {
      try { trade = JSON.parse(tradeRaw); } catch { trade = { raw: tradeRaw }; }
    }
    return {
      title,
      content,
      summary: main.querySelector('#f-summary').value.trim(),
      tags: tagList,
      trade_data: trade,
      is_published: published ? 1 : 0,
    };
  }

  async function save(published) {
    const data = collect(published);
    if (!data) return;
    try {
      if (isEdit) await api.updatePost(params.id, data);
      else await api.createPost(data);
      window.location.hash = isEdit ? `#/blog/${params.id}` : '#/blog';
    } catch (e) {
      alert('保存失败：' + e.message);
    }
  }

  main.querySelector('#btn-draft').onclick = () => save(false);
  main.querySelector('#btn-publish').onclick = () => save(true);
}

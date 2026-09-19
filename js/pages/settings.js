import api from '../api.js';
import { icon } from '../utils/icons.js';
import { escapeHtml, formatTime } from '../utils/format.js';
import { showConfirm } from '../utils/motion.js';

export async function SettingsPage(main) {
  main.innerHTML = `
    <div class="settings-page">
      <div class="page-header">
        <h1>设置</h1>
      </div>
      <div class="settings-grid">
        <section class="settings-card glass-card">
          <div class="panel-head">
            <span class="panel-icon">${icon('coins', 16)}</span>
            <span>交易所 API</span>
          </div>
          <div id="exchange-list"><div class="loading-state"><span class="loading-spinner"></span></div></div>
          <form id="exchange-form" class="exchange-form">
            <div class="form-row">
              <div class="form-group">
                <label>交易所</label>
                <select class="form-select" name="exchange" id="ex-select">
                  <option value="okx">OKX</option>
                  <option value="binance">Binance</option>
                </select>
              </div>
              <div class="form-group">
                <label>备注</label>
                <input class="form-input" name="label" placeholder="可选" />
              </div>
            </div>
            <div class="form-group">
              <label>API Key</label>
              <input class="form-input" name="api_key" required autocomplete="off" />
            </div>
            <div class="form-group">
              <label>Secret Key</label>
              <input class="form-input" name="secret_key" type="password" required autocomplete="off" />
            </div>
            <div class="form-group" id="pass-group">
              <label>Passphrase（仅 OKX）</label>
              <input class="form-input" name="passphrase" autocomplete="off" />
            </div>
            <button type="submit" class="btn-primary">保存配置</button>
          </form>
        </section>
        <section class="settings-card glass-card">
          <div class="panel-head">
            <span class="panel-icon">${icon('settings', 16)}</span>
            <span>站点信息</span>
          </div>
          <form id="site-form">
            <div class="form-group">
              <label>站点标题</label>
              <input class="form-input" name="site_title" id="site_title" maxlength="200" />
            </div>
            <div class="form-group">
              <label>站点描述</label>
              <textarea class="form-textarea" name="site_description" id="site_description" maxlength="200" rows="3"></textarea>
            </div>
            <button type="submit" class="btn-primary">保存站点</button>
            <div id="site-msg"></div>
          </form>
          <div class="site-hint">
            ${icon('shield', 18)}
            <p>API Key 仅在服务端 AES-256-GCM 加密存储，前端不会接触明文。</p>
          </div>
        </section>
      </div>
    </div>
  `;

  const exSelect = main.querySelector('#ex-select');
  exSelect.addEventListener('change', () => {
    main.querySelector('#pass-group').style.display = exSelect.value === 'okx' ? '' : 'none';
  });

  await loadExchanges(main);
  await loadSite(main);

  main.querySelector('#exchange-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.addExchange({
        exchange: fd.get('exchange'),
        api_key: fd.get('api_key'),
        secret_key: fd.get('secret_key'),
        passphrase: fd.get('passphrase') || undefined,
        label: fd.get('label') || undefined,
      });
      e.target.reset();
      main.querySelector('#pass-group').style.display = '';
      await loadExchanges(main);
      alert('已保存');
    } catch (err) {
      alert('保存失败：' + err.message);
    }
  });

  main.querySelector('#site-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.updateSite({
        site_title: main.querySelector('#site_title').value.trim(),
        site_description: main.querySelector('#site_description').value.trim(),
      });
      main.querySelector('#site-msg').innerHTML = '<div class="success-banner">已保存</div>';
    } catch (err) {
      main.querySelector('#site-msg').innerHTML = `<div class="error-banner">${escapeHtml(err.message)}</div>`;
    }
  });
}

async function loadExchanges(main) {
  const el = main.querySelector('#exchange-list');
  try {
    const list = await api.listExchanges();
    if (!list?.length) {
      el.innerHTML = '<div class="empty-state"><p>尚未配置交易所</p></div>';
      return;
    }
    el.innerHTML = list.map((x) => `
      <div class="ex-row" data-id="${x.id}">
        <span class="ex-name">${escapeHtml(x.exchange.toUpperCase())}</span>
        <span class="muted">${escapeHtml(x.label || '')}</span>
        <span class="ex-status ${x.is_active ? 'on' : 'off'}">${x.is_active ? '启用' : '停用'}</span>
        <button type="button" class="btn-ghost btn-sm" data-toggle="${x.id}">切换</button>
        <button type="button" class="btn-danger btn-sm" data-del="${x.id}">删除</button>
      </div>
    `).join('');
    el.querySelectorAll('[data-toggle]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          await api.toggleExchange(Number(b.dataset.toggle));
          await loadExchanges(main);
        } catch (e) { alert(e.message); }
      });
    });
    el.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!(await showConfirm('删除配置', '确定删除该交易所配置吗？'))) return;
        try {
          await api.deleteExchange(Number(b.dataset.del));
          await loadExchanges(main);
        } catch (e) { alert(e.message); }
      });
    });
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
  }
}

async function loadSite(main) {
  try {
    const site = await api.getSite();
    main.querySelector('#site_title').value = site.site_title || '';
    main.querySelector('#site_description').value = site.site_description || '';
  } catch { /* ignore */ }
}

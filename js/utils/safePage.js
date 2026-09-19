/**
 * 包一层页面，保证单页异常不影响壳与其他路由。
 * 用法：route('/x', { component: safePage(XPage, 'x') })
 *
 * 快速切页时旧页 async 回调可能抛错（DOM 已换）—— signal.aborted 则静默忽略。
 */
export function safePage(fn, name = 'page') {
  return async function safePageWrapper(main, ctx = {}) {
    const { signal, alive } = ctx;
    const stillAlive = () => {
      if (signal?.aborted) return false;
      if (typeof alive === 'function') return !!alive();
      return true;
    };

    try {
      const cleanup = await fn(main, ctx);
      if (!stillAlive()) return undefined;
      return typeof cleanup === 'function' ? cleanup : undefined;
    } catch (err) {
      // 过期页面的异常：不要覆盖当前页
      if (!stillAlive()) {
        console.debug(`[page:${name}] stale render ignored:`, err?.message || err);
        return undefined;
      }
      console.error(`[page:${name}]`, err);
      try {
        main.innerHTML = `
          <div class="empty-state">
            <p><strong>${name}</strong> 页面加载失败</p>
            <p class="muted">${String(err?.message || err)}</p>
            <a class="btn-ghost" href="#/">返回首页</a>
          </div>
        `;
      } catch { /* main 可能已不在文档中 */ }
      return undefined;
    }
  };
}

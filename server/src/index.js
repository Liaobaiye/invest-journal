import './env.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { init } from './app.js';
import { flushDb } from './db/store.js';
import { PROXY_URL } from './env.js';
import { proxyEnabled } from './services/httpClient.js';
import { startAltcoinScheduler } from './services/altcoinService.js';
import { autoStartVolatilityMonitorIfArmed } from './services/volatilityMonitor.js';
import { autoStartAlertMonitorsIfArmed } from './services/alertsMonitor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const app = init();

// Serve static frontend from project root when present
const ROOT = path.join(__dirname, '..', '..');
app.use(expressStaticSafe(ROOT));

function expressStaticSafe(dir) {
  return (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    let urlPath = decodeURIComponent(req.path);
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.normalize(path.join(dir, urlPath));
    if (!file.startsWith(dir)) return next();
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file);
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
      };
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
      return;
    }
    if (!path.extname(urlPath)) {
      const index = path.join(dir, 'index.html');
      if (fs.existsSync(index)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        fs.createReadStream(index).pipe(res);
        return;
      }
    }
    next();
  };
}

const server = app.listen(PORT, () => {
  console.log(`[Server] http://localhost:${PORT}`);
  console.log(`[Server] API  http://localhost:${PORT}/api`);
  console.log(`[Server] UI   http://localhost:${PORT}/`);
  if (PROXY_URL) console.log(`[Server] Proxy ${PROXY_URL} (enabled=${proxyEnabled()})`);
  else console.log('[Server] Proxy 未配置 — 国内访问 OKX/Binance 会失败，请在 server/.env 设置 HTTP_PROXY');
  try {
    startAltcoinScheduler();
  } catch (e) {
    console.error('[Altcoin] scheduler failed to start:', e.message || e);
  }
  try {
    const armed = autoStartVolatilityMonitorIfArmed();
    if (armed) console.log('[VolMonitor] auto-started (enabled volatility configs found)');
  } catch (e) {
    console.error('[VolMonitor] auto-start error:', e.message || e);
  }
  try {
    const st = autoStartAlertMonitorsIfArmed();
    if (st) {
      const parts = [];
      if (st.stablecoin?.running) parts.push('stablecoin');
      if (st.drawdown?.running) parts.push('drawdown');
      if (st.news?.running) parts.push('news');
      if (parts.length) console.log('[Alerts] auto-started:', parts.join(', '));
    }
  } catch (e) {
    console.error('[Alerts] auto-start error:', e.message || e);
  }
});

function shutdown() {
  flushDb();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

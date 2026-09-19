/**
 * 本地预览邮件 HTML（不发信）
 * 用法: node scripts/preview-email.js
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderTestEmailHtml,
  renderDepegEmailHtml,
  renderAltcoinSpikeEmailHtml,
} from '../server/src/services/emailTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'server', 'data', 'email-preview');
mkdirSync(outDir, { recursive: true });

const test = renderTestEmailHtml({ time: new Date().toISOString() });
const depeg = renderDepegEmailHtml(
  {
    threshold: 0.005,
    timestamp_utc: new Date().toISOString(),
    source: 'coinbase_v2_spot',
  },
  [
    { symbol: 'USDT', price: 0.9942, deviation_pct: -0.58, deviation_bps: -58, severity: 'warn' },
    { symbol: 'DAI', price: 1.012, deviation_pct: 1.2, deviation_bps: 120, severity: 'critical' },
  ]
);

const altcoin = renderAltcoinSpikeEmailHtml(
  {
    scannedAt: new Date().toISOString(),
    params: { threshold: 5, daysToCheck: 10, previousDays: 7 },
    totalSymbols: 487,
    source: 'binance_spot_1d',
    trigger: 'auto',
    coins: [
      { symbol: 'IQUSDT', date: '2026-09-01', ratio: 49.7, volume: 4134621252, avgPrevVolume: 83189384 },
      { symbol: 'AUCTIONUSDT', date: '2026-08-30', ratio: 41.29, volume: 3449265, avgPrevVolume: 83529 },
      { symbol: 'TNSRUSDT', date: '2026-08-30', ratio: 26.09, volume: 219713205, avgPrevVolume: 8420541 },
    ],
  },
  { urlPath: 'http://localhost:3000/api/altcoin/history/demo.html' }
);

writeFileSync(path.join(outDir, 'test-email.html'), test);
writeFileSync(path.join(outDir, 'depeg-email.html'), depeg);
writeFileSync(path.join(outDir, 'altcoin-email.html'), altcoin);
console.log('Wrote', path.join(outDir, 'test-email.html'));
console.log('Wrote', path.join(outDir, 'depeg-email.html'));
console.log('Wrote', path.join(outDir, 'altcoin-email.html'));

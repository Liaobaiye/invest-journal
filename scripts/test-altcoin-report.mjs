/**
 * 冒烟：历史 HTML 报告 + 山寨币邮件模板（不发信、不打外网）
 * 用法: node scripts/test-altcoin-report.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAltcoinReport, listReports, REPORT_DIR } from '../server/src/services/altcoinReport.js';
import { renderAltcoinSpikeEmailHtml } from '../server/src/services/emailTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fakeCandles = (base = 100) =>
  Array.from({ length: 40 }, (_, i) => {
    const open = base + i * 0.2;
    const close = open + (i % 3 === 0 ? -1.5 : 1.2);
    const high = Math.max(open, close) + 2.5;
    const low = Math.min(open, close) - 0.8;
    return {
      openTime: Date.UTC(2026, 7, 10 + i),
      open,
      high,
      low,
      close,
      volume: i === 30 ? 500000 : 80000 + i * 100,
      closeTime: Date.UTC(2026, 7, 11 + i),
      quoteVolume: 0,
    };
  });

const scanPayload = {
  coins: [
    {
      rank: 1,
      symbol: 'IQUSDT',
      date: '2026-09-01',
      openTime: Date.UTC(2026, 8, 1),
      open: 0.012,
      high: 0.02,
      low: 0.011,
      close: 0.013,
      volume: 4134621252,
      quoteVolume: 0,
      avgPrevVolume: 83189384,
      ratio: 49.7,
    },
    {
      rank: 2,
      symbol: 'AUCTIONUSDT',
      date: '2026-08-30',
      openTime: Date.UTC(2026, 7, 30),
      open: 12,
      high: 18,
      low: 11,
      close: 12.5,
      volume: 3449265,
      quoteVolume: 0,
      avgPrevVolume: 83529,
      ratio: 41.29,
    },
  ],
  scannedAt: new Date().toISOString(),
  params: { threshold: 5, daysToCheck: 10, previousDays: 7, maxSymbols: 0, concurrency: 6 },
  totalSymbols: 487,
  durationMs: 12345,
  source: 'binance_spot_1d',
};

const report = await buildAltcoinReport(scanPayload, {
  topN: 30,
  trigger: 'manual',
  fetchKlines: async (symbol) => fakeCandles(symbol === 'IQUSDT' ? 0.01 : 10),
});

if (!report?.file) {
  console.error('FAIL: report not created', report);
  process.exit(1);
}

const items = listReports();
console.log('REPORT_DIR', REPORT_DIR);
console.log('report.file', report.file);
console.log('history count', items.length);
console.log('latest', items[0]?.file, items[0]?.coinCount, items[0]?.urlPath);

const emailHtml = renderAltcoinSpikeEmailHtml(
  { ...scanPayload, trigger: 'auto' },
  report
);
const outDir = path.join(__dirname, '..', 'server', 'data', 'email-preview');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'altcoin-email.html'), emailHtml);
console.log('email preview', path.join(outDir, 'altcoin-email.html'));
console.log('OK');

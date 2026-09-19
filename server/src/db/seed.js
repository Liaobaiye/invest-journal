import bcrypt from 'bcryptjs';
import { getDb, loadDb, saveDb, nextId, now, flushDb } from './store.js';

export async function seed() {
  loadDb();
  const db = getDb();
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  if (!db.users.find((u) => u.username === username)) {
    const hash = await bcrypt.hash(password, 12);
    db.users.push({
      id: nextId('users'),
      username,
      password_hash: hash,
      created_at: now(),
    });
    console.log(`[seed] created admin "${username}"`);
  }

  if (!db.posts.length) {
    db.posts.push({
      id: nextId('posts'),
      title: 'BTC 市场结构复盘：关键支撑与仓位管理',
      summary: '从日线结构出发，复盘近期 BTC 的突破与回踩，并记录对应的仓位调整逻辑。',
      content: '## 市场背景\n\n近期 BTC 在日线级别完成了一次有效突破，随后回踩前高确认支撑。\n\n## 交易计划\n\n- 突破确认后分批建仓\n- 回撤不超过 8% 不加仓\n- 目标位分批止盈\n\n> 纪律是交易者的护城河。\n',
      tags: ['BTC', '复盘'],
      trade_data: {
        symbol: 'BTC-USDT',
        exchange: 'okx',
        side: 'long',
        entry: 68000,
        target: 72000,
        stop: 64500,
        size: 0.15,
        lever: 10,
        note: '日线突破回踩确认后分批建仓',
      },
      is_published: 1,
      created_at: now(),
      updated_at: now(),
    });
    console.log('[seed] created sample post');
  }

  if (!db.position_records.length) {
    db.position_records.push(
      {
        id: nextId('position_records'),
        exchange: 'okx',
        pos_id: 'okx-demo-1',
        inst_id: 'BTC-USDT',
        pos_side: 'long',
        lever: 10,
        open_avg_px: 68200,
        close_avg_px: 0,
        mark_px: 69500,
        avg_px: 68200,
        max_size: '0.15',
        pnl: 0,
        pnl_ratio: 0,
        upl: 195,
        upl_ratio: 0.019,
        margin: 1023,
        status: 'open',
        open_time: String(Date.now() - 3600000),
        close_time: '',
        operations: [],
        created_at: now(),
        updated_at: now(),
      },
      {
        id: nextId('position_records'),
        exchange: 'binance',
        pos_id: 'bn-demo-1',
        inst_id: 'ETHUSDT',
        pos_side: 'short',
        lever: 5,
        open_avg_px: 3520,
        close_avg_px: 3480,
        mark_px: 3480,
        avg_px: 3520,
        max_size: '1.2',
        pnl: 48,
        pnl_ratio: 0.011,
        upl: 0,
        upl_ratio: 0,
        margin: 844.8,
        status: 'closed',
        open_time: String(Date.now() - 86400000 * 3),
        close_time: String(Date.now() - 86400000),
        operations: [
          { action: 'open', price: 3520, size: '1.2' },
          { action: 'close', price: 3480, size: '1.2' },
        ],
        created_at: now(),
        updated_at: now(),
      }
    );
    db.settings.last_balance_okx = '18000';
    db.settings.last_balance_binance = '7000';
    console.log('[seed] created sample positions');
  }

  if (!db.alert_configs.length) {
    db.alert_configs.push({
      id: nextId('alert_configs'),
      alert_type: 'volatility',
      exchange: 'okx',
      symbol: 'BTC-USDT',
      timeframes: ['5m'],
      thresholds: { '5m': 3 },
      is_enabled: 0,
      created_at: now(),
      updated_at: now(),
    });
  }

  saveDb();
  flushDb();
  console.log('[seed] done');
}

// CLI
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('seed.js')) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

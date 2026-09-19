/** 仓位收益回撤口径单测 */
import { pnlDrawdownPct, posKey } from '../server/src/services/alertsMonitor.js';

function assertEq(a, b, msg) {
  if (Math.abs(a - b) > 1e-9) {
    console.error('FAIL', msg, a, '!=', b);
    process.exit(1);
  }
  console.log('OK', msg, a);
}

assertEq(pnlDrawdownPct(1000, 700), 30, '1000→700 = 30%');
assertEq(pnlDrawdownPct(1000, 1000), 0, 'no drawdown');
assertEq(pnlDrawdownPct(1000, 1200), -20, 'still above peak (negative dd)');
assertEq(pnlDrawdownPct(0, 50), 0, 'peak 0 → 0');
assertEq(pnlDrawdownPct(100, -50), 150, '100→-50 = 150%');
assertEq(posKey({ exchange: 'okx', symbol: 'BTC-USDT', posSide: 'long' }), 'okx|BTC-USDT|long', 'pos key');
console.log('ALL OK');

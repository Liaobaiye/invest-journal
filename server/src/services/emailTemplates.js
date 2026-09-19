/** 邮件 HTML 模板 — 内联样式，兼容常见邮件客户端 */

function shell({ title, accent = '#f0c060', bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#12122a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:22px 28px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${accent};margin-right:10px;vertical-align:middle;"></div>
            <span style="color:#e8e8f0;font-size:15px;font-weight:700;letter-spacing:0.5px;vertical-align:middle;">投资日志</span>
            <span style="color:#8088a8;font-size:12px;margin-left:10px;vertical-align:middle;">通知</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 8px;color:#e8e8f0;font-size:20px;font-weight:700;line-height:1.35;">${title}</h1>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 22px;border-top:1px solid rgba(255,255,255,0.08);color:#8088a8;font-size:12px;line-height:1.6;">
            本邮件由「投资日志」自动发送 · 请勿直接回复
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function metaRow(label, value) {
  return `<tr>
    <td style="padding:6px 0;color:#8088a8;font-size:13px;width:88px;">${label}</td>
    <td style="padding:6px 0;color:#e8e8f0;font-size:13px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">${value}</td>
  </tr>`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SEV = {
  ok: { label: '正常', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  depeg: { label: '轻微脱钩', color: '#f0c060', bg: 'rgba(240,192,96,0.14)' },
  warn: { label: '明显脱钩', color: '#f0c060', bg: 'rgba(240,192,96,0.18)' },
  critical: { label: '严重脱钩', color: '#f87171', bg: 'rgba(248,113,113,0.16)' },
  error: { label: '失败', color: '#8088a8', bg: 'rgba(128,128,128,0.12)' },
};

export function renderTestEmailHtml({ time }) {
  return shell({
    title: 'SMTP 配置测试成功',
    bodyHtml: `
      <p style="margin:0 0 18px;color:#8088a8;font-size:14px;line-height:1.7;">
        若你能看到这封邮件，说明发件箱、授权码与收件人配置均正常，可用于告警通知。
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        ${metaRow('发送时间', esc(time))}
        ${metaRow('来源', '投资日志 · 测试邮件')}
      </table>
      <div style="margin-top:22px;padding:12px 14px;border-radius:10px;background:rgba(240,192,96,0.08);border:1px solid rgba(240,192,96,0.25);color:#f0c060;font-size:13px;">
        下一步可在「提醒 → 稳定币脱锚」开启「脱钩发邮件」，命中阈值时自动通知。
      </div>`,
  });
}

export function renderTestEmailText({ time }) {
  return `SMTP 配置测试成功\n发送时间: ${time}\n来源: 投资日志 · 测试邮件\n`;
}

export function renderDepegEmailHtml(result, depegged) {
  const thr = (Number(result.threshold) * 100).toFixed(3);
  const rows = depegged
    .map((r) => {
      const sev = SEV[r.severity] || SEV.warn;
      const price = r.price == null ? '—' : Number(r.price).toFixed(6);
      const dev =
        r.deviation_pct == null
          ? '—'
          : `${r.deviation_pct >= 0 ? '+' : ''}${Number(r.deviation_pct).toFixed(4)}%`;
      const bps =
        r.deviation_bps == null
          ? '—'
          : `${r.deviation_bps >= 0 ? '+' : ''}${Number(r.deviation_bps).toFixed(1)} bps`;
      return `<tr>
        <td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-weight:700;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">${esc(r.symbol)}</td>
        <td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-family:ui-monospace,Consolas,monospace;">$${price}</td>
        <td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f87171;font-family:ui-monospace,Consolas,monospace;">${dev}</td>
        <td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-family:ui-monospace,Consolas,monospace;">${bps}</td>
        <td style="padding:12px 10px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="display:inline-block;padding:3px 10px;border-radius:99px;background:${sev.bg};color:${sev.color};font-size:12px;font-weight:700;">${sev.label}</span>
        </td>
      </tr>`;
    })
    .join('');

  const symbols = depegged.map((r) => r.symbol).join(', ');
  return shell({
    title: `稳定币脱钩告警 · ${esc(symbols)}`,
    accent: '#f87171',
    bodyHtml: `
      <p style="margin:0 0 18px;color:#8088a8;font-size:14px;line-height:1.7;">
        检测到下列稳定币相对 $1.00 偏离超过阈值 <strong style="color:#f0c060;">±${thr}%</strong>，请关注储备与赎回情况。
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;font-weight:600;letter-spacing:0.4px;">币种</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;font-weight:600;">价格</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;font-weight:600;">偏离</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;font-weight:600;">bps</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;font-weight:600;">状态</th>
        </tr>
        ${rows}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;width:100%;">
        ${metaRow('检测时间', esc(result.timestamp_utc || ''))}
        ${metaRow('数据源', esc(result.source || 'coinbase_v2_spot'))}
        ${metaRow('告警数', String(depegged.length))}
      </table>`,
  });
}

export function renderAltcoinSpikeEmailHtml(scanResult, report = null) {
  const coins = (scanResult.coins || []).slice(0, 15);
  const n = scanResult.coins?.length || 0;
  const top = scanResult.coins?.[0];
  const avg = n
    ? (scanResult.coins.reduce((s, c) => s + (c.ratio || 0), 0) / n).toFixed(2)
    : '—';
  const p = scanResult.params || {};
  const rows = coins
    .map((c, i) => {
      const vol = c.volume >= 1e9
        ? `${(c.volume / 1e9).toFixed(2)}B`
        : c.volume >= 1e6
          ? `${(c.volume / 1e6).toFixed(2)}M`
          : c.volume >= 1e3
            ? `${(c.volume / 1e3).toFixed(2)}K`
            : Number(c.volume || 0).toFixed(0);
      return `<tr>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-size:12px;">${i + 1}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-weight:700;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">${esc(c.symbol)}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-family:ui-monospace,Consolas,monospace;">${esc(c.date)}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f87171;font-weight:700;font-family:ui-monospace,Consolas,monospace;">${Number(c.ratio || 0).toFixed(2)}x</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-family:ui-monospace,Consolas,monospace;">${vol}</td>
      </tr>`;
    })
    .join('');

  const reportLine = report?.urlPath
    ? `<div style="margin-top:18px;padding:12px 14px;border-radius:10px;background:rgba(240,192,96,0.08);border:1px solid rgba(240,192,96,0.25);color:#f0c060;font-size:13px;line-height:1.7;">
        完整 K 线报告已生成。<br/>
        直接打开：<a href="${esc(report.urlPath)}" style="color:#f0c060;word-break:break-all;font-family:ui-monospace,Consolas,monospace;">${esc(report.urlPath)}</a><br/>
        也可在站点打开「山寨币 → 历史报告」。
      </div>`
    : `<div style="margin-top:18px;padding:12px 14px;border-radius:10px;background:rgba(240,192,96,0.08);border:1px solid rgba(240,192,96,0.25);color:#f0c060;font-size:13px;">
        可在站点「山寨币监测 → 历史报告」查看 K 线。
      </div>`;

  return shell({
    title: n
      ? `山寨币异动 · ${n} 个币 · 最高 ${Number(top?.ratio || 0).toFixed(2)}x`
      : '山寨币扫描完成 · 无异动',
    accent: '#f0c060',
    bodyHtml: `
      <p style="margin:0 0 18px;color:#8088a8;font-size:14px;line-height:1.7;">
        Binance 现货扫描完成。检测规则：成交量 &gt; <strong style="color:#f0c060;">${esc(p.threshold ?? 5)}×</strong>
        前 <strong style="color:#f0c060;">${esc(p.previousDays ?? 7)}</strong> 日均量，
        且实体长度 ≤ 上影线（长上影 / 射击之星类）。
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:18px;">
        <tr>
          <td align="center" style="padding:14px 8px;border-right:1px solid rgba(255,255,255,0.06);">
            <div style="color:#8088a8;font-size:11px;">异动数量</div>
            <div style="color:#e8e8f0;font-size:20px;font-weight:700;margin-top:4px;font-family:ui-monospace,Consolas,monospace;">${n}</div>
          </td>
          <td align="center" style="padding:14px 8px;border-right:1px solid rgba(255,255,255,0.06);">
            <div style="color:#8088a8;font-size:11px;">最高倍数</div>
            <div style="color:#f87171;font-size:20px;font-weight:700;margin-top:4px;font-family:ui-monospace,Consolas,monospace;">${top ? Number(top.ratio).toFixed(2) + 'x' : '—'}</div>
          </td>
          <td align="center" style="padding:14px 8px;border-right:1px solid rgba(255,255,255,0.06);">
            <div style="color:#8088a8;font-size:11px;">平均倍数</div>
            <div style="color:#e8e8f0;font-size:20px;font-weight:700;margin-top:4px;font-family:ui-monospace,Consolas,monospace;">${avg === '—' ? '—' : avg + 'x'}</div>
          </td>
          <td align="center" style="padding:14px 8px;">
            <div style="color:#8088a8;font-size:11px;">扫描对数</div>
            <div style="color:#e8e8f0;font-size:20px;font-weight:700;margin-top:4px;font-family:ui-monospace,Consolas,monospace;">${esc(scanResult.totalSymbols ?? '—')}</div>
          </td>
        </tr>
      </table>
      ${
        coins.length
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
              <tr>
                <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">#</th>
                <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">币种</th>
                <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">异动日</th>
                <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">倍数</th>
                <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">现量</th>
              </tr>
              ${rows}
            </table>
            ${n > 15 ? `<p style="margin:10px 0 0;color:#8088a8;font-size:12px;">仅展示 Top 15，完整 ${n} 个见历史报告。</p>` : ''}`
          : `<div style="padding:18px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:#8088a8;font-size:14px;">本次扫描未发现符合条件的成交量异动。</div>`
      }
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;width:100%;">
        ${metaRow('扫描时间', esc(scanResult.scannedAt || ''))}
        ${metaRow('检测窗口', `${esc(p.daysToCheck ?? '—')} 天 / 对比前 ${esc(p.previousDays ?? '—')} 天`)}
        ${metaRow('触发方式', scanResult.trigger === 'auto' ? '自动 · 每 4 小时' : '手动扫描')}
        ${metaRow('数据源', esc(scanResult.source || 'binance_spot_1d'))}
      </table>
      ${reportLine}`,
  });
}

export function renderAltcoinSpikeEmailText(scanResult, report = null) {
  const coins = (scanResult.coins || []).slice(0, 15);
  const n = scanResult.coins?.length || 0;
  const top = scanResult.coins?.[0];
  const p = scanResult.params || {};
  const lines = coins.map(
    (c, i) => `${i + 1}. ${c.symbol}  ${c.date}  ${Number(c.ratio || 0).toFixed(2)}x`
  );
  return [
    n
      ? `山寨币异动扫描：${n} 个币，最高 ${Number(top?.ratio || 0).toFixed(2)}x`
      : '山寨币扫描完成：无异动',
    `阈值: ${p.threshold ?? 5}x 前 ${p.previousDays ?? 7} 日均量`,
    `扫描时间: ${scanResult.scannedAt || ''}`,
    report?.urlPath ? `报告链接: ${report.urlPath}` : '',
    '',
    ...lines,
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderVolatilityAlertEmailHtml(hits) {
  const list = Array.isArray(hits) ? hits : [];
  const rows = list
    .map((h) => {
      const amp = Number(h.ampPct ?? h.actual_pct ?? 0).toFixed(2);
      const move = h.movePct != null ? Number(h.movePct).toFixed(2) : '—';
      const thr = h.threshold_pct != null ? Number(h.threshold_pct).toFixed(2) : '—';
      return `<tr>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-weight:700;font-family:ui-monospace,Consolas,monospace;">${esc(h.symbol)}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-family:ui-monospace,Consolas,monospace;">${esc(h.timeframe || '')}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;">${esc(String(h.exchange || '').toUpperCase())}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f87171;font-weight:700;font-family:ui-monospace,Consolas,monospace;">${amp}%</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-family:ui-monospace,Consolas,monospace;">${move}%</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-family:ui-monospace,Consolas,monospace;">${thr}%</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-family:ui-monospace,Consolas,monospace;">${h.price != null ? esc(Number(h.price).toLocaleString('en-US')) : '—'}</td>
      </tr>`;
    })
    .join('');

  return shell({
    title: `波动告警 · ${list.length} 条`,
    accent: '#f87171',
    bodyHtml: `
      <p style="margin:0 0 18px;color:#8088a8;font-size:14px;line-height:1.7;">
        服务端波动监测检测到下列交易对短周期<strong style="color:#f87171;">振幅</strong>超过配置阈值。
        数据源：OKX / Binance 公共 K 线（经代理）。
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">币种</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">周期</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">交易所</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">振幅</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">涨跌</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">阈值</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">现价</th>
        </tr>
        ${rows}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;width:100%;">
        ${metaRow('检测时间', esc(new Date().toISOString()))}
        ${metaRow('来源', '投资日志 · 波动监测')}
      </table>
      <div style="margin-top:18px;padding:12px 14px;border-radius:10px;background:rgba(240,192,96,0.08);border:1px solid rgba(240,192,96,0.25);color:#f0c060;font-size:13px;">
        可在站点「提醒 → 告警历史」查看完整记录；在提醒页可调整周期/阈值/币种。
      </div>`,
  });
}

export function renderVolatilityAlertEmailText(hits) {
  const list = Array.isArray(hits) ? hits : [];
  const lines = list.map((h) => {
    const amp = Number(h.ampPct ?? h.actual_pct ?? 0).toFixed(2);
    const move = h.movePct != null ? Number(h.movePct).toFixed(2) : '—';
    return `${h.symbol} ${h.timeframe || ''} ${String(h.exchange || '').toUpperCase()} 振幅${amp}% 涨跌${move}% 阈值${h.threshold_pct}%`;
  });
  return ['波动告警', `时间: ${new Date().toISOString()}`, '', ...lines, '', '详见站点提醒页告警历史。'].join('\n');
}

export function renderDrawdownEmailHtml(payload) {
  const {
    equity, peak, drawdownPct, threshold,
    symbol = '', details = [], totalPnl, peakTotalPnl,
  } = payload || {};
  const rows = (details || [])
    .filter((d) => d.peakPnl > 0 && d.drawdownPct >= 0.5)
    .slice(0, 12)
    .map((d) => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-family:ui-monospace,Consolas,monospace;">${esc(d.exchange)}:${esc(d.symbol)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;">${esc(d.posSide || '')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-family:ui-monospace,Consolas,monospace;">${Number(d.peakPnl).toFixed(2)}U</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;font-family:ui-monospace,Consolas,monospace;">${Number(d.upl).toFixed(2)}U</td>
      <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f87171;font-weight:700;font-family:ui-monospace,Consolas,monospace;">${Number(d.drawdownPct).toFixed(2)}%</td>
    </tr>`)
    .join('');

  return shell({
    title: `仓位收益回撤 · ${Number(drawdownPct).toFixed(2)}%${symbol ? ' · ' + esc(symbol) : ''}`,
    accent: '#f87171',
    bodyHtml: `
      <p style="margin:0 0 14px;color:#8088a8;font-size:14px;line-height:1.7;">
        仓位<strong style="color:#f0c060;">浮盈</strong>相对峰值回落超过阈值。
        口径：峰值盈利 ${Number(peak).toFixed(2)}U → 当前 ${Number(equity).toFixed(2)}U，
        回撤 = (峰值 − 当前) / 峰值。
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);margin-bottom:14px;">
        <tr>
          <td align="center" style="padding:14px;border-right:1px solid rgba(255,255,255,0.06);">
            <div style="color:#8088a8;font-size:11px;">收益回撤</div>
            <div style="color:#f87171;font-size:22px;font-weight:700;margin-top:4px;">${Number(drawdownPct).toFixed(2)}%</div>
          </td>
          <td align="center" style="padding:14px;border-right:1px solid rgba(255,255,255,0.06);">
            <div style="color:#8088a8;font-size:11px;">阈值</div>
            <div style="color:#e8e8f0;font-size:22px;font-weight:700;margin-top:4px;">${Number(threshold).toFixed(2)}%</div>
          </td>
          <td align="center" style="padding:14px;border-right:1px solid rgba(255,255,255,0.06);">
            <div style="color:#8088a8;font-size:11px;">峰值收益</div>
            <div style="color:#e8e8f0;font-size:18px;font-weight:700;margin-top:4px;font-family:ui-monospace,Consolas,monospace;">${Number(peak).toFixed(2)}U</div>
          </td>
          <td align="center" style="padding:14px;">
            <div style="color:#8088a8;font-size:11px;">当前收益</div>
            <div style="color:#e8e8f0;font-size:18px;font-weight:700;margin-top:4px;font-family:ui-monospace,Consolas,monospace;">${Number(equity).toFixed(2)}U</div>
          </td>
        </tr>
      </table>
      ${rows ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <th align="left" style="padding:8px 10px;color:#8088a8;font-size:12px;">仓位</th>
          <th align="left" style="padding:8px 10px;color:#8088a8;font-size:12px;">方向</th>
          <th align="left" style="padding:8px 10px;color:#8088a8;font-size:12px;">峰值收益</th>
          <th align="left" style="padding:8px 10px;color:#8088a8;font-size:12px;">当前收益</th>
          <th align="left" style="padding:8px 10px;color:#8088a8;font-size:12px;">回撤</th>
        </tr>
        ${rows}
      </table>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;width:100%;">
        ${metaRow('全部浮盈', `${Number(totalPnl ?? 0).toFixed(2)}U / 总峰值 ${Number(peakTotalPnl ?? 0).toFixed(2)}U`)}
        ${metaRow('检测时间', esc(new Date().toISOString()))}
        ${metaRow('来源', '投资日志 · 仓位收益回撤')}
      </table>`,
  });
}

export function renderDrawdownEmailText(payload) {
  const { equity, peak, drawdownPct, threshold, symbol, details } = payload || {};
  const lines = (details || [])
    .filter((d) => d.peakPnl > 0 && d.drawdownPct >= 0.5)
    .slice(0, 8)
    .map((d) => `${d.exchange}:${d.symbol} ${d.posSide} 峰值${d.peakPnl}U→${d.upl}U 回撤${d.drawdownPct.toFixed(2)}%`);
  return [
    '仓位收益回撤告警',
    `时间: ${new Date().toISOString()}`,
    `${symbol || ''} 回撤 ${Number(drawdownPct).toFixed(2)}%  阈值 ${Number(threshold).toFixed(2)}%`,
    `收益: ${Number(equity).toFixed(2)}U → 峰值 ${Number(peak).toFixed(2)}U`,
    '',
    ...lines,
  ].join('\n');
}

export function renderNewsAlertEmailHtml({ items, maxRisk, threshold, ai }) {
  const list = Array.isArray(items) ? items : [];
  const rows = list
    .slice(0, 10)
    .map((n) => `<tr>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#f87171;font-weight:700;font-family:ui-monospace,Consolas,monospace;">${esc(n.score)}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#e8e8f0;">${esc(n.title)}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-size:12px;">${esc((n.categories || []).join(', '))}</td>
      <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,0.06);color:#8088a8;font-size:12px;">${esc(n.source || '')}</td>
    </tr>`)
    .join('');
  return shell({
    title: `消息面告警 · 风险 ${maxRisk}`,
    accent: '#f0c060',
    bodyHtml: `
      <p style="margin:0 0 18px;color:#8088a8;font-size:14px;line-height:1.7;">
        新闻风险评分 <strong style="color:#f87171;">${esc(maxRisk)}</strong>
        达到阈值 <strong style="color:#f0c060;">${esc(threshold)}</strong>。
        ${ai ? `AI 评分：<strong style="color:#f0c060;">${esc(ai.score)}</strong>。` : '（关键词规则评分；配置 AI_API_* 后可叠加 AI）'}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
        <tr>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">风险</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">标题</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">分类</th>
          <th align="left" style="padding:10px;color:#8088a8;font-size:12px;">来源</th>
        </tr>
        ${rows}
      </table>
      <div style="margin-top:16px;padding:12px 14px;border-radius:10px;background:rgba(240,192,96,0.08);border:1px solid rgba(240,192,96,0.25);color:#f0c060;font-size:13px;">
        分类开关：宏观 / 监管 / 交易所 · 详见站点「提醒 → 告警历史」
      </div>`,
  });
}

export function renderNewsAlertEmailText({ items, maxRisk, threshold, ai }) {
  const list = Array.isArray(items) ? items : [];
  return [
    '消息面告警',
    `时间: ${new Date().toISOString()}`,
    `风险: ${maxRisk}  阈值: ${threshold}${ai ? `  AI: ${ai.score}` : ''}`,
    '',
    ...list.slice(0, 10).map((n) => `[${n.score}] ${n.title}`),
  ].join('\n');
}

export function renderDepegEmailText(result, depegged) {
  const thr = (Number(result.threshold) * 100).toFixed(3);
  const lines = depegged.map((r) => {
    const price = r.price == null ? '—' : Number(r.price).toFixed(6);
    const dev =
      r.deviation_pct == null
        ? '—'
        : `${r.deviation_pct >= 0 ? '+' : ''}${Number(r.deviation_pct).toFixed(4)}%`;
    const sev = (SEV[r.severity] || SEV.warn).label;
    return `${r.symbol}: $${price}  偏离 ${dev}  ${sev}`;
  });
  return (
    `稳定币脱钩告警\n阈值: ±${thr}%\n检测时间: ${result.timestamp_utc || ''}\n` +
    `数据源: ${result.source || ''}\n\n` +
    lines.join('\n') +
    `\n\n请关注储备与赎回情况。\n`
  );
}

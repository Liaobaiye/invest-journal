/**
 * SMTP 邮件通知（对齐原项目 notifier）
 * 配置：EMAIL_USER / EMAIL_AUTH_CODE / EMAIL_TO（163/QQ/Gmail 自动识别）
 */
import nodemailer from 'nodemailer';
import {
  renderTestEmailHtml,
  renderTestEmailText,
  renderDepegEmailHtml,
  renderDepegEmailText,
  renderAltcoinSpikeEmailHtml,
  renderAltcoinSpikeEmailText,
  renderVolatilityAlertEmailHtml,
  renderVolatilityAlertEmailText,
} from './emailTemplates.js';

let transporter = null;

export function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_AUTH_CODE && process.env.EMAIL_TO);
}

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_AUTH_CODE;
  if (!user || !pass) {
    console.warn('[Mailer] EMAIL_USER/EMAIL_AUTH_CODE not set — email disabled');
    return null;
  }
  const domain = (user.split('@')[1] || '').toLowerCase();
  const smtpMap = {
    '163.com': { host: 'smtp.163.com', port: 465 },
    'qq.com': { host: 'smtp.qq.com', port: 465 },
    'gmail.com': { host: 'smtp.gmail.com', port: 465 },
  };
  const smtp = smtpMap[domain] || { host: `smtp.${domain}`, port: 465 };
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: true,
    auth: { user, pass },
  });
  return transporter;
}

/** 同步等待结果，便于 API 返回成功/失败 */
export async function sendMail({ subject, text, html }) {
  const t = getTransporter();
  if (!t) throw new Error('邮件未配置：请设置 EMAIL_USER / EMAIL_AUTH_CODE / EMAIL_TO');
  const to = process.env.EMAIL_TO;
  if (!to) throw new Error('未设置 EMAIL_TO');
  const info = await t.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  });
  console.log(`[Mailer] sent: ${subject}`);
  return info;
}

export function sendMailFireAndForget(payload) {
  sendMail(payload)
    .then(() => {})
    .catch((e) => console.error('[Mailer] failed:', e.message));
}

/** 稳定币脱钩告警邮件（HTML + 纯文本回退） */
export function sendStablecoinDepegEmail(result) {
  const depegged = (result.results || []).filter((r) => r.depegged);
  if (!depegged.length) return Promise.resolve(null);
  const symbols = depegged.map((r) => r.symbol).join(', ');
  return sendMail({
    subject: `【稳定币脱钩】${symbols}`,
    text: renderDepegEmailText(result, depegged),
    html: renderDepegEmailHtml(result, depegged),
  });
}

/** 山寨币异动扫描汇总邮件 */
export function sendAltcoinSpikeEmail(scanResult, report = null) {
  const n = scanResult?.coins?.length || 0;
  const top = scanResult?.coins?.[0];
  const subject = n
    ? `【山寨币异动】${n} 个币 · 最高 ${Number(top.ratio || 0).toFixed(2)}x`
    : '【山寨币异动】扫描完成 · 无命中';
  return sendMail({
    subject,
    text: renderAltcoinSpikeEmailText(scanResult, report),
    html: renderAltcoinSpikeEmailHtml(scanResult, report),
  });
}

export async function sendTestEmail() {
  const time = new Date().toISOString();
  return sendMail({
    subject: '【投资日志】SMTP 测试邮件',
    text: renderTestEmailText({ time }),
    html: renderTestEmailHtml({ time }),
  });
}

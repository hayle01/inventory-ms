import { env } from '../config.js';
import type { NotificationJobData } from './types.js';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const BRAND_COLOR = '#4338ca';
const TEXT_COLOR = '#1f2937';
const MUTED_COLOR = '#6b7280';
const BORDER_COLOR = '#e5e7eb';
const BG_COLOR = '#f4f4f5';

function resetLink(token: string): string {
  return `${env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface LayoutAction {
  /** A clickable button CTA, e.g. the invite link. */
  kind: 'button';
  label: string;
  url: string;
}
interface LayoutCode {
  /** A short code the recipient types in manually, e.g. the reset code. */
  kind: 'code';
  value: string;
}

/**
 * Table-based layout with every style inline -- required for consistent
 * rendering across email clients (no external stylesheet, no flex/grid).
 * Shared by every notification template so they stay visually consistent.
 */
function renderLayout(options: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  action: LayoutAction | LayoutCode;
  footnote: string;
}): string {
  const appName = escapeHtml(env.APP_NAME);
  const actionHtml =
    options.action.kind === 'button'
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:8px;background-color:${BRAND_COLOR};">
                      <a href="${options.action.url}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(options.action.label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 4px;font-size:12px;color:${MUTED_COLOR};">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="margin:0;font-size:12px;color:${BRAND_COLOR};word-break:break-all;">${options.action.url}</p>`
      : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="border-radius:8px;border:1px solid ${BORDER_COLOR};background-color:#fafafa;padding:18px 28px;">
                      <span style="display:block;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${TEXT_COLOR};">${escapeHtml(options.action.value)}</span>
                    </td>
                  </tr>
                </table>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${appName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:${BG_COLOR};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(options.preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background-color:#ffffff;border:1px solid ${BORDER_COLOR};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:${BRAND_COLOR};padding:20px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">${appName}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:18px;line-height:1.4;color:${TEXT_COLOR};">${escapeHtml(options.heading)}</h1>
                <div style="font-size:14px;line-height:1.6;color:${TEXT_COLOR};">${options.bodyHtml}</div>
                ${actionHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${BORDER_COLOR};background-color:#fafafa;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED_COLOR};">${escapeHtml(options.footnote)}</p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:${MUTED_COLOR};">This is an automated message from ${appName}. Please don't reply to this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * `user-invite` still links straight to `/reset-password` (an invite isn't a
 * security-sensitive "did you request this" moment the way a forgot-password
 * reset is). `password-reset` instead emails a short code the recipient
 * types into the app's verify-code page -- matches the MFA challenge pattern
 * and avoids putting a bearer credential straight into an email link.
 */
export function renderNotificationEmail(
  job: NotificationJobData,
  recipientFullName: string,
): RenderedEmail {
  const appName = env.APP_NAME;
  const firstName = recipientFullName.split(/\s+/)[0] ?? recipientFullName;

  if (job.template === 'user-invite') {
    const token = job.data['resetToken'] ?? '';
    const link = resetLink(token);
    return {
      subject: `You've been invited to ${appName}`,
      text: `Hi ${recipientFullName},\n\nAn administrator created an account for you on ${appName}. Set your password to get started:\n\n${link}\n\nThis link expires in 7 days.\n\nIf you weren't expecting this, you can ignore this email.`,
      html: renderLayout({
        preheader: `Set your password to activate your ${appName} account.`,
        heading: `Welcome to ${appName}`,
        bodyHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(firstName)},</p><p style="margin:0;">An administrator created an account for you. Set your password below to activate it and sign in.</p>`,
        action: { kind: 'button', label: 'Set your password', url: link },
        footnote:
          "This link expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.",
      }),
    };
  }

  const code = job.data['resetCode'] ?? '';
  return {
    subject: `Your ${appName} password reset code`,
    text: `Hi ${recipientFullName},\n\nWe received a request to reset your password on ${appName}. Your verification code is:\n\n${code}\n\nEnter this code in the app to continue. This code expires in 30 minutes. If you didn't request this, you can safely ignore this email -- your password will not change.`,
    html: renderLayout({
      preheader: `Your ${appName} password reset code: ${code}`,
      heading: 'Reset your password',
      bodyHtml: `<p style="margin:0 0 12px;">Hi ${escapeHtml(firstName)},</p><p style="margin:0;">We received a request to reset your password. Enter this verification code in the app to continue:</p>`,
      action: { kind: 'code', value: code },
      footnote:
        "This code expires in 30 minutes. If you didn't request this, you can safely ignore this email -- your password will not change.",
    }),
  };
}

import { env } from '../config.js';

interface SendViaResendInput {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends over HTTPS (Resend's REST API) instead of a raw SMTP socket.
 * Exists specifically because some hosts (Render's free tier, at least)
 * block outbound SMTP ports entirely as an anti-abuse measure, which a
 * plain nodemailer/SMTP transport has no way to work around -- HTTPS on
 * port 443 is never blocked. Used in place of getMailTransport() whenever
 * RESEND_API_KEY is set; see sendNotification.ts for the selection logic.
 */
export async function sendViaResend(input: SendViaResendInput): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('sendViaResend called without RESEND_API_KEY configured.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable response body>');
    throw new Error(`Resend API request failed: ${String(response.status)} ${body}`);
  }
}

import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config.js';
import { logger } from '../logger.js';

let transporter: Transporter | undefined;

/**
 * Standard SMTP transport (host/port/secure/auth), configured entirely from
 * environment variables -- no dev-only mail catcher is baked in. Point
 * MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASSWORD at whatever SMTP provider or
 * relay you use (a real provider, a local SMTP debugging tool, etc.).
 * Returns `undefined` when MAIL_HOST isn't configured so the caller can
 * skip sending (and log it) instead of crashing the worker.
 */
export function getMailTransport(): Transporter | undefined {
  if (!env.MAIL_HOST) return undefined;
  transporter ??= nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT ?? 587,
    secure: env.MAIL_SECURE,
    auth:
      env.MAIL_USER && env.MAIL_PASSWORD
        ? { user: env.MAIL_USER, pass: env.MAIL_PASSWORD }
        : undefined,
  });
  return transporter;
}

export async function verifyMailTransport(): Promise<void> {
  const transport = getMailTransport();
  if (!transport) {
    logger.warn(
      'MAIL_HOST is not set -- outbound email is disabled; notification jobs will be skipped.',
    );
    return;
  }
  try {
    await transport.verify();
    logger.info({ host: env.MAIL_HOST, port: env.MAIL_PORT }, 'SMTP transport verified');
  } catch (error) {
    logger.error(
      { err: error },
      'SMTP transport verification failed -- check MAIL_* configuration',
    );
  }
}

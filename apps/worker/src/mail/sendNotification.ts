import { env } from '../config.js';
import { logger } from '../logger.js';
import { NotificationUserModel } from '../models/User.js';
import { getMailTransport } from './transport.js';
import { renderNotificationEmail } from './templates.js';
import type { NotificationJobData } from './types.js';

/**
 * Processes one `notifications` job: looks up the recipient by ID (the job
 * payload only ever carries the ID and a short-lived token, never the full
 * user document), renders the template, and sends via SMTP. Throws on
 * failure so BullMQ's configured retry/backoff (set at enqueue time in the
 * API) takes over; a missing user or missing SMTP config is logged and
 * treated as a no-op success instead of an infinite retry loop, since
 * retrying can never fix either condition.
 */
export async function sendNotification(job: NotificationJobData): Promise<void> {
  const user = await NotificationUserModel.findById(job.toUserId).lean();
  if (!user) {
    logger.warn(
      { toUserId: job.toUserId, template: job.template },
      'Notification recipient not found; skipping',
    );
    return;
  }

  const transport = getMailTransport();
  if (!transport) {
    logger.warn(
      { toUserId: job.toUserId, template: job.template },
      'MAIL_HOST not configured; skipping notification (no SMTP transport)',
    );
    return;
  }

  const email = renderNotificationEmail(job, user.fullName);

  await transport.sendMail({
    from: env.MAIL_FROM ?? `no-reply@${env.APP_NAME.toLowerCase().replace(/\s+/g, '-')}.local`,
    to: user.emailNormalized,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  logger.info({ toUserId: job.toUserId, template: job.template }, 'Notification email sent');
}

import { Worker, type Job } from 'bullmq';
import { logger } from './logger.js';
import { connectMongo, disconnectMongo } from './mongo.js';
import { closeBullMqConnection, getBullMqConnection } from './redisConnection.js';
import { QUEUE_NAMES } from './queues/queueNames.js';
import { sendNotification } from './mail/sendNotification.js';
import { verifyMailTransport } from './mail/transport.js';
import type { NotificationJobData } from './mail/types.js';

/**
 * Job processors are registered per module as features land (notifications,
 * exports, alert evaluation, reconciliation). Job payloads must contain IDs
 * only, never full sensitive documents, and processors must be idempotent.
 * Only `notifications` has a real processor so far -- the rest remain
 * no-op stubs until exports/alerts/reconciliation are built.
 */
async function main(): Promise<void> {
  await connectMongo();
  await verifyMailTransport();
  const connection = getBullMqConnection();

  const workers = Object.values(QUEUE_NAMES).map((queueName) => {
    if (queueName === QUEUE_NAMES.notifications) {
      return new Worker<NotificationJobData>(
        queueName,
        async (job: Job<NotificationJobData>) => {
          logger.info({ queueName, jobId: job.id, jobName: job.name }, 'Processing job');
          await sendNotification(job.data);
        },
        { connection },
      );
    }
    return new Worker(
      queueName,
      (job) => {
        logger.info({ queueName, jobId: job.id, jobName: job.name }, 'Processing job');
        return Promise.resolve();
      },
      { connection },
    );
  });

  logger.info({ queues: Object.values(QUEUE_NAMES) }, 'Worker process started');

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Worker shutting down gracefully');
    void (async () => {
      await Promise.all(workers.map((worker) => worker.close()));
      await disconnectMongo();
      await closeBullMqConnection();
      process.exit(0);
    })();
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Fatal error during worker startup');
  process.exitCode = 1;
});

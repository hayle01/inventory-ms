import { createServer } from 'node:http';
import { Worker, type Job } from 'bullmq';
import { env } from './config.js';
import { logger } from './logger.js';
import { connectMongo, disconnectMongo } from './mongo.js';
import { closeBullMqConnection, getBullMqConnection } from './redisConnection.js';
import { QUEUE_NAMES } from './queues/queueNames.js';
import { sendNotification } from './mail/sendNotification.js';
import { verifyMailTransport } from './mail/transport.js';
import type { NotificationJobData } from './mail/types.js';

/**
 * The worker is a queue consumer, not a web server -- but some free-tier
 * hosts (e.g. Render) only offer a free instance type for "Web Service"
 * deployments, not for a true background-worker service type. This
 * listener exists solely so those hosts see a live HTTP port and don't
 * treat the process as failed; it carries no application traffic.
 *
 * Only started in production: locally, this process runs alongside the API
 * (which binds its own PORT), and both apps' .env files default to the
 * same port value -- starting this unconditionally collides with the API
 * on `pnpm dev`. Render always runs each service as its own process with
 * its own assigned port, so there's no equivalent collision there.
 */
function startHealthServer(): void {
  if (env.NODE_ENV !== 'production') return;
  const port = Number(process.env['PORT'] ?? 4000);
  createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }).listen(port, () => {
    logger.info({ port }, 'Worker health server listening');
  });
}

/**
 * Job processors are registered per module as features land (notifications,
 * exports, alert evaluation, reconciliation). Job payloads must contain IDs
 * only, never full sensitive documents, and processors must be idempotent.
 * Only `notifications` has a real processor so far -- the rest remain
 * no-op stubs until exports/alerts/reconciliation are built.
 */
async function main(): Promise<void> {
  startHealthServer();
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

import { Worker } from 'bullmq';
import { logger } from './logger.js';
import { connectMongo, disconnectMongo } from './mongo.js';
import { closeBullMqConnection, getBullMqConnection } from './redisConnection.js';
import { QUEUE_NAMES } from './queues/queueNames.js';

/**
 * Job processors are registered per module as features land (notifications,
 * exports, alert evaluation, reconciliation). Job payloads must contain IDs
 * only, never full sensitive documents, and processors must be idempotent.
 */
async function main(): Promise<void> {
  await connectMongo();
  const connection = getBullMqConnection();

  const workers = Object.values(QUEUE_NAMES).map(
    (queueName) =>
      new Worker(
        queueName,
        (job) => {
          logger.info({ queueName, jobId: job.id, jobName: job.name }, 'Processing job');
          return Promise.resolve();
        },
        { connection },
      ),
  );

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

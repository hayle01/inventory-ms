import { createApp } from './app.js';
import { env } from './config.js';
import { logger } from './shared/observability/logger.js';
import { connectMongo, disconnectMongo } from './shared/infrastructure/mongo.js';
import { disconnectRedis, getRedisClient } from './shared/infrastructure/redis.js';

async function main(): Promise<void> {
  await connectMongo();
  getRedisClient();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API server listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(() => {
      void (async () => {
        await disconnectMongo();
        await disconnectRedis();
        process.exit(0);
      })();
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Fatal error during startup');
  process.exitCode = 1;
});

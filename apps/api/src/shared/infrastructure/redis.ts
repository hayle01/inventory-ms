import { Redis } from 'ioredis';
import { env } from '../../config.js';
import { logger } from '../observability/logger.js';

let client: Redis | undefined;

export function getRedisClient(): Redis {
  client ??= new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
  });
  client.on('error', (err: Error) => {
    logger.error({ err }, 'Redis client error');
  });
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = undefined;
  }
}

import { Redis } from 'ioredis';
import { env } from './config.js';

let connection: Redis | undefined;

/** BullMQ requires `maxRetriesPerRequest: null` on its Redis connection. */
export function getBullMqConnection(): Redis {
  connection ??= new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

export async function closeBullMqConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}

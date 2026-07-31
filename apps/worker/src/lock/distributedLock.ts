import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

/**
 * Redis-backed distributed lock for scheduled jobs, preventing duplicate
 * execution across worker instances. Uses SET NX PX for acquisition and a
 * compare-and-delete Lua script for safe release (only the holder that
 * acquired the lock can release it).
 */
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export interface LockHandle {
  readonly key: string;
  release: () => Promise<void>;
}

export async function acquireLock(
  redis: Redis,
  key: string,
  ttlMs: number,
): Promise<LockHandle | undefined> {
  const token = randomUUID();
  const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
  if (result !== 'OK') return undefined;

  return {
    key,
    release: async () => {
      await redis.eval(RELEASE_SCRIPT, 1, key, token);
    },
  };
}

export async function withLock<T>(
  redis: Redis,
  key: string,
  ttlMs: number,
  work: () => Promise<T>,
): Promise<T | undefined> {
  const lock = await acquireLock(redis, key, ttlMs);
  if (!lock) return undefined;
  try {
    return await work();
  } finally {
    await lock.release();
  }
}

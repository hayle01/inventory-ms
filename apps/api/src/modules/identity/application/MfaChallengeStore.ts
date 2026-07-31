import { randomUUID } from 'node:crypto';
import { getRedisClient } from '../../../shared/infrastructure/redis.js';

const CHALLENGE_TTL_SECONDS = 5 * 60;

function challengeKey(challengeId: string): string {
  return `mfa:challenge:${challengeId}`;
}

export async function createMfaChallenge(userId: string): Promise<string> {
  const challengeId = randomUUID();
  await getRedisClient().set(challengeKey(challengeId), userId, 'EX', CHALLENGE_TTL_SECONDS);
  return challengeId;
}

export async function consumeMfaChallenge(challengeId: string): Promise<string | undefined> {
  const redis = getRedisClient();
  const key = challengeKey(challengeId);
  const userId = await redis.get(key);
  if (!userId) return undefined;
  await redis.del(key);
  return userId;
}

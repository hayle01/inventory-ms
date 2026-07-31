import type { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { getRedisClient } from '../infrastructure/redis.js';
import { RateLimitedError } from '../http/errors.js';
import type { rateLimitPolicies } from '../../config.js';

type PolicyName = keyof typeof rateLimitPolicies;

const limiters = new Map<PolicyName, RateLimiterRedis>();

function getLimiter(
  policyName: PolicyName,
  policy: { points: number; durationSeconds: number },
): RateLimiterRedis {
  let limiter = limiters.get(policyName);
  limiter ??= new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix: `rl:${policyName}`,
    points: policy.points,
    duration: policy.durationSeconds,
  });
  limiters.set(policyName, limiter);
  return limiter;
}

/**
 * Redis-backed distributed rate limiter. `keyFn` derives the limiter key
 * (e.g. IP, normalized account, user ID) from the request; combine multiple
 * policies on one route when a spec calls for "by IP and by account".
 */
export function rateLimit(
  policyName: PolicyName,
  policy: { points: number; durationSeconds: number },
  keyFn: (req: Request) => string,
) {
  const limiter = getLimiter(policyName, policy);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    limiter
      .consume(key)
      .then(() => {
        next();
      })
      .catch((rejection: unknown) => {
        const retryAfterSeconds =
          typeof rejection === 'object' && rejection !== null && 'msBeforeNext' in rejection
            ? Math.ceil((rejection as { msBeforeNext: number }).msBeforeNext / 1000)
            : policy.durationSeconds;
        next(new RateLimitedError(retryAfterSeconds));
      });
  };
}

export function clientIp(req: Request): string {
  return req.ip ?? 'unknown';
}

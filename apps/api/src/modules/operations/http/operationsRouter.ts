import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { getRedisClient } from '../../../shared/infrastructure/redis.js';

export const operationsRouter: Router = Router();

/** Liveness: process event loop responds. No authentication, no sensitive detail. */
operationsRouter.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/** Readiness: critical dependencies (MongoDB, Redis) are reachable. */
operationsRouter.get(
  '/health/ready',
  asyncHandler(async (_req, res) => {
    const mongoReady = mongoose.connection.readyState === mongoose.ConnectionStates.connected;
    let redisReady: boolean;
    try {
      await getRedisClient().ping();
      redisReady = true;
    } catch {
      redisReady = false;
    }

    const ready = mongoReady && redisReady;
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      dependencies: { mongo: mongoReady, redis: redisReady },
    });
  }),
);

operationsRouter.get('/version', (_req, res) => {
  sendSuccess(res, {
    name: process.env['npm_package_name'] ?? '@inventory-ms/api',
    version: process.env['npm_package_version'] ?? '0.0.0',
    commit: process.env['GIT_COMMIT_SHA'] ?? 'unknown',
  });
});

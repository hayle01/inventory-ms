import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createStockCountRequestSchema,
  rejectStockCountRequestSchema,
  reverseStockCountRequestSchema,
  updateStockCountRequestSchema,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { rateLimit } from '../../../shared/security/rateLimit.js';
import { rateLimitPolicies } from '../../../config.js';
import { IdempotencyKeyRequiredError, ValidationError } from '../../../shared/http/errors.js';
import * as CountService from '../application/CountService.js';
import { toStockCountDto } from './mappers.js';

export const stockCountsRouter: Router = Router();

stockCountsRouter.use(requireAuth);
stockCountsRouter.use(
  rateLimit(
    'generalApi',
    rateLimitPolicies.generalApi,
    (req) => req.authContext?.userId.toString() ?? 'anonymous',
  ),
);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

function requireIdempotencyKey(req: { header: (name: string) => string | undefined }): string {
  const key = req.header('Idempotency-Key');
  if (!key) throw new IdempotencyKeyRequiredError();
  return key;
}

const stockPostingLimiter = rateLimit(
  'stockPosting',
  rateLimitPolicies.stockPosting,
  (req) => req.authContext?.userId.toString() ?? 'anonymous',
);

stockCountsRouter.get(
  '/',
  requirePermission('stock_counts.view'),
  asyncHandler(async (req, res) => {
    const counts = await CountService.listStockCounts(getAuthContext(req).organizationId);
    sendSuccess(res, counts.map(toStockCountDto));
  }),
);

stockCountsRouter.post(
  '/',
  requirePermission('stock_counts.create'),
  doubleCsrfProtection,
  validateBody(createStockCountRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockCount = await CountService.createStockCount(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof CountService.createStockCount>[1],
    );
    sendSuccess(res, toStockCountDto(stockCount), 201);
  }),
);

stockCountsRouter.get(
  '/:id',
  requirePermission('stock_counts.view'),
  asyncHandler(async (req, res) => {
    const stockCount = await CountService.getStockCountById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockCountDto(stockCount));
  }),
);

stockCountsRouter.patch(
  '/:id',
  requirePermission('stock_counts.create'),
  doubleCsrfProtection,
  validateBody(updateStockCountRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockCount = await CountService.updateStockCount(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof CountService.updateStockCount>[2],
    );
    sendSuccess(res, toStockCountDto(stockCount));
  }),
);

stockCountsRouter.post(
  '/:id/submit',
  requirePermission('stock_counts.submit'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockCount = await CountService.submitStockCount(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockCountDto(stockCount));
  }),
);

stockCountsRouter.post(
  '/:id/approve',
  requirePermission('stock_counts.approve'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockCount = await CountService.approveStockCount(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockCountDto(stockCount));
  }),
);

stockCountsRouter.post(
  '/:id/reject',
  requirePermission('stock_counts.reject'),
  doubleCsrfProtection,
  validateBody(rejectStockCountRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { reason } = req.body as { reason: string };
    const stockCount = await CountService.rejectStockCount(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
    );
    sendSuccess(res, toStockCountDto(stockCount));
  }),
);

stockCountsRouter.post(
  '/:id/post',
  requirePermission('stock_counts.post'),
  doubleCsrfProtection,
  stockPostingLimiter,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const stockCount = await CountService.postStockCount(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      idempotencyKey,
    );
    sendSuccess(res, toStockCountDto(stockCount));
  }),
);

stockCountsRouter.post(
  '/:id/reverse',
  requirePermission('stock_counts.reverse'),
  doubleCsrfProtection,
  stockPostingLimiter,
  validateBody(reverseStockCountRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const { reason } = req.body as { reason: string };
    const stockCount = await CountService.reverseStockCount(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
      idempotencyKey,
    );
    sendSuccess(res, toStockCountDto(stockCount));
  }),
);

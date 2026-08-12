import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createStockAdjustmentRequestSchema,
  rejectStockAdjustmentRequestSchema,
  reverseStockAdjustmentRequestSchema,
  updateStockAdjustmentRequestSchema,
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
import * as AdjustmentService from '../application/AdjustmentService.js';
import { toStockAdjustmentDto } from './mappers.js';

export const stockAdjustmentsRouter: Router = Router();

stockAdjustmentsRouter.use(requireAuth);
stockAdjustmentsRouter.use(
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

stockAdjustmentsRouter.get(
  '/',
  requirePermission('adjustments.view'),
  asyncHandler(async (req, res) => {
    const adjustments = await AdjustmentService.listStockAdjustments(
      getAuthContext(req).organizationId,
    );
    sendSuccess(res, adjustments.map(toStockAdjustmentDto));
  }),
);

stockAdjustmentsRouter.post(
  '/',
  requirePermission('adjustments.create'),
  doubleCsrfProtection,
  validateBody(createStockAdjustmentRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockAdjustment = await AdjustmentService.createStockAdjustment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof AdjustmentService.createStockAdjustment>[1],
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment), 201);
  }),
);

stockAdjustmentsRouter.get(
  '/:id',
  requirePermission('adjustments.view'),
  asyncHandler(async (req, res) => {
    const stockAdjustment = await AdjustmentService.getStockAdjustmentById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment));
  }),
);

stockAdjustmentsRouter.patch(
  '/:id',
  requirePermission('adjustments.create'),
  doubleCsrfProtection,
  validateBody(updateStockAdjustmentRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockAdjustment = await AdjustmentService.updateStockAdjustment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof AdjustmentService.updateStockAdjustment>[2],
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment));
  }),
);

stockAdjustmentsRouter.post(
  '/:id/submit',
  requirePermission('adjustments.submit'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockAdjustment = await AdjustmentService.submitStockAdjustment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment));
  }),
);

stockAdjustmentsRouter.post(
  '/:id/approve',
  requirePermission('adjustments.approve'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockAdjustment = await AdjustmentService.approveStockAdjustment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment));
  }),
);

stockAdjustmentsRouter.post(
  '/:id/reject',
  requirePermission('adjustments.reject'),
  doubleCsrfProtection,
  validateBody(rejectStockAdjustmentRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { reason } = req.body as { reason: string };
    const stockAdjustment = await AdjustmentService.rejectStockAdjustment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment));
  }),
);

stockAdjustmentsRouter.post(
  '/:id/post',
  requirePermission('adjustments.post'),
  doubleCsrfProtection,
  stockPostingLimiter,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const stockAdjustment = await AdjustmentService.postStockAdjustment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      idempotencyKey,
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment));
  }),
);

stockAdjustmentsRouter.post(
  '/:id/reverse',
  requirePermission('adjustments.reverse'),
  doubleCsrfProtection,
  stockPostingLimiter,
  validateBody(reverseStockAdjustmentRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const { reason } = req.body as { reason: string };
    const stockAdjustment = await AdjustmentService.reverseStockAdjustment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
      idempotencyKey,
    );
    sendSuccess(res, toStockAdjustmentDto(stockAdjustment));
  }),
);

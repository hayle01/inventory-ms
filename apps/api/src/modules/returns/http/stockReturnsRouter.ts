import { Router } from 'express';
import { Types } from 'mongoose';
import { createStockReturnRequestSchema } from '@inventory-ms/contracts';
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
import * as ReturnService from '../application/ReturnService.js';
import { toStockReturnDto } from './mappers.js';

export const stockReturnsRouter: Router = Router();

stockReturnsRouter.use(requireAuth);
stockReturnsRouter.use(
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

stockReturnsRouter.get(
  '/',
  requirePermission('returns.view'),
  asyncHandler(async (req, res) => {
    const returns = await ReturnService.listStockReturns(getAuthContext(req).organizationId);
    sendSuccess(res, returns.map(toStockReturnDto));
  }),
);

stockReturnsRouter.post(
  '/',
  requirePermission('returns.create'),
  doubleCsrfProtection,
  validateBody(createStockReturnRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockReturn = await ReturnService.createStockReturn(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof ReturnService.createStockReturn>[1],
    );
    sendSuccess(res, toStockReturnDto(stockReturn), 201);
  }),
);

stockReturnsRouter.get(
  '/:id',
  requirePermission('returns.view'),
  asyncHandler(async (req, res) => {
    const stockReturn = await ReturnService.getStockReturnById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockReturnDto(stockReturn));
  }),
);

stockReturnsRouter.post(
  '/:id/post',
  requirePermission('returns.post'),
  doubleCsrfProtection,
  stockPostingLimiter,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const stockReturn = await ReturnService.postStockReturn(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      idempotencyKey,
    );
    sendSuccess(res, toStockReturnDto(stockReturn));
  }),
);

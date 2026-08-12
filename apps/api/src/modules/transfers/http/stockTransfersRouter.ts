import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createStockTransferRequestSchema,
  reverseStockTransferRequestSchema,
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
import * as TransferService from '../application/TransferService.js';
import { toStockTransferDto } from './mappers.js';

export const stockTransfersRouter: Router = Router();

stockTransfersRouter.use(requireAuth);
stockTransfersRouter.use(
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

stockTransfersRouter.get(
  '/',
  requirePermission('transfers.view'),
  asyncHandler(async (req, res) => {
    const transfers = await TransferService.listStockTransfers(getAuthContext(req).organizationId);
    sendSuccess(res, transfers.map(toStockTransferDto));
  }),
);

stockTransfersRouter.post(
  '/',
  requirePermission('transfers.create'),
  doubleCsrfProtection,
  validateBody(createStockTransferRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockTransfer = await TransferService.createStockTransfer(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof TransferService.createStockTransfer>[1],
    );
    sendSuccess(res, toStockTransferDto(stockTransfer), 201);
  }),
);

stockTransfersRouter.get(
  '/:id',
  requirePermission('transfers.view'),
  asyncHandler(async (req, res) => {
    const stockTransfer = await TransferService.getStockTransferById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockTransferDto(stockTransfer));
  }),
);

stockTransfersRouter.post(
  '/:id/submit',
  requirePermission('transfers.submit'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockTransfer = await TransferService.submitStockTransfer(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockTransferDto(stockTransfer));
  }),
);

stockTransfersRouter.post(
  '/:id/approve',
  requirePermission('transfers.approve'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockTransfer = await TransferService.approveStockTransfer(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockTransferDto(stockTransfer));
  }),
);

stockTransfersRouter.post(
  '/:id/post',
  requirePermission('transfers.post'),
  doubleCsrfProtection,
  stockPostingLimiter,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const stockTransfer = await TransferService.postStockTransfer(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      idempotencyKey,
    );
    sendSuccess(res, toStockTransferDto(stockTransfer));
  }),
);

// Gated on `transfers.post` -- there is no dedicated `transfers.receive`
// permission in the catalog; receiving an in-transit transfer is treated as
// part of the same posting-family capability.
stockTransfersRouter.post(
  '/:id/receive',
  requirePermission('transfers.post'),
  doubleCsrfProtection,
  stockPostingLimiter,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const stockTransfer = await TransferService.receiveStockTransfer(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      idempotencyKey,
    );
    sendSuccess(res, toStockTransferDto(stockTransfer));
  }),
);

stockTransfersRouter.post(
  '/:id/reverse',
  requirePermission('transfers.reverse'),
  doubleCsrfProtection,
  stockPostingLimiter,
  validateBody(reverseStockTransferRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const { reason } = req.body as { reason: string };
    const stockTransfer = await TransferService.reverseStockTransfer(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
      idempotencyKey,
    );
    sendSuccess(res, toStockTransferDto(stockTransfer));
  }),
);

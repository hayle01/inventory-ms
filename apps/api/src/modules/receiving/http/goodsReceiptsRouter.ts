import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createGoodsReceiptRequestSchema,
  reverseGoodsReceiptRequestSchema,
  updateGoodsReceiptRequestSchema,
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
import * as ReceiptService from '../application/ReceiptService.js';
import { toGoodsReceiptDto } from './mappers.js';

export const goodsReceiptsRouter: Router = Router();

goodsReceiptsRouter.use(requireAuth);
goodsReceiptsRouter.use(
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

goodsReceiptsRouter.get(
  '/',
  requirePermission('receipts.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const receipts = await ReceiptService.listReceipts(auth.organizationId);
    sendSuccess(res, receipts.map(toGoodsReceiptDto));
  }),
);

goodsReceiptsRouter.post(
  '/',
  requirePermission('receipts.create'),
  doubleCsrfProtection,
  validateBody(createGoodsReceiptRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const receipt = await ReceiptService.createReceipt(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof ReceiptService.createReceipt>[1],
    );
    sendSuccess(res, toGoodsReceiptDto(receipt), 201);
  }),
);

goodsReceiptsRouter.get(
  '/:id',
  requirePermission('receipts.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const receipt = await ReceiptService.getReceiptById(
      auth.organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toGoodsReceiptDto(receipt));
  }),
);

goodsReceiptsRouter.patch(
  '/:id',
  requirePermission('receipts.update'),
  doubleCsrfProtection,
  validateBody(updateGoodsReceiptRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const receipt = await ReceiptService.updateReceipt(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof ReceiptService.updateReceipt>[2],
    );
    sendSuccess(res, toGoodsReceiptDto(receipt));
  }),
);

goodsReceiptsRouter.post(
  '/:id/verify',
  requirePermission('receipts.verify'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const receipt = await ReceiptService.verifyReceipt(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toGoodsReceiptDto(receipt));
  }),
);

goodsReceiptsRouter.post(
  '/:id/post',
  requirePermission('receipts.post'),
  doubleCsrfProtection,
  stockPostingLimiter,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const receipt = await ReceiptService.postReceipt(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      idempotencyKey,
    );
    sendSuccess(res, toGoodsReceiptDto(receipt));
  }),
);

goodsReceiptsRouter.post(
  '/:id/reverse',
  requirePermission('receipts.reverse'),
  doubleCsrfProtection,
  stockPostingLimiter,
  validateBody(reverseGoodsReceiptRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const idempotencyKey = requireIdempotencyKey(req);
    const { reason } = req.body as { reason: string };
    const receipt = await ReceiptService.reverseReceipt(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
      idempotencyKey,
    );
    sendSuccess(res, toGoodsReceiptDto(receipt));
  }),
);

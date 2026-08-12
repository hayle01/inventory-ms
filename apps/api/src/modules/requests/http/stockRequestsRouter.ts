import { Router } from 'express';
import { Types } from 'mongoose';
import {
  approveStockRequestRequestSchema,
  cancelStockRequestRequestSchema,
  createStockRequestRequestSchema,
  rejectStockRequestRequestSchema,
  updateStockRequestRequestSchema,
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
import { ValidationError } from '../../../shared/http/errors.js';
import * as StockRequestService from '../application/StockRequestService.js';
import { toStockRequestDto } from './mappers.js';

export const stockRequestsRouter: Router = Router();

stockRequestsRouter.use(requireAuth);
stockRequestsRouter.use(
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

stockRequestsRouter.get(
  '/',
  requirePermission('stock_requests.view'),
  asyncHandler(async (req, res) => {
    const requests = await StockRequestService.listStockRequests(
      getAuthContext(req).organizationId,
    );
    sendSuccess(res, requests.map(toStockRequestDto));
  }),
);

stockRequestsRouter.post(
  '/',
  requirePermission('stock_requests.create'),
  doubleCsrfProtection,
  validateBody(createStockRequestRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockRequest = await StockRequestService.createStockRequest(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof StockRequestService.createStockRequest>[1],
    );
    sendSuccess(res, toStockRequestDto(stockRequest), 201);
  }),
);

stockRequestsRouter.get(
  '/:id',
  requirePermission('stock_requests.view'),
  asyncHandler(async (req, res) => {
    const stockRequest = await StockRequestService.getStockRequestById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockRequestDto(stockRequest));
  }),
);

stockRequestsRouter.patch(
  '/:id',
  requirePermission('stock_requests.update'),
  doubleCsrfProtection,
  validateBody(updateStockRequestRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockRequest = await StockRequestService.updateStockRequest(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof StockRequestService.updateStockRequest>[2],
    );
    sendSuccess(res, toStockRequestDto(stockRequest));
  }),
);

stockRequestsRouter.post(
  '/:id/submit',
  requirePermission('stock_requests.submit'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockRequest = await StockRequestService.submitStockRequest(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toStockRequestDto(stockRequest));
  }),
);

stockRequestsRouter.post(
  '/:id/approve',
  requirePermission('stock_requests.approve'),
  doubleCsrfProtection,
  validateBody(approveStockRequestRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const stockRequest = await StockRequestService.approveStockRequest(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof StockRequestService.approveStockRequest>[2],
    );
    sendSuccess(res, toStockRequestDto(stockRequest));
  }),
);

stockRequestsRouter.post(
  '/:id/reject',
  requirePermission('stock_requests.reject'),
  doubleCsrfProtection,
  validateBody(rejectStockRequestRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { reason } = req.body as { reason: string };
    const stockRequest = await StockRequestService.rejectStockRequest(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
    );
    sendSuccess(res, toStockRequestDto(stockRequest));
  }),
);

stockRequestsRouter.post(
  '/:id/cancel',
  requirePermission('stock_requests.cancel'),
  doubleCsrfProtection,
  validateBody(cancelStockRequestRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { reason } = req.body as { reason: string };
    const stockRequest = await StockRequestService.cancelStockRequest(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
    );
    sendSuccess(res, toStockRequestDto(stockRequest));
  }),
);

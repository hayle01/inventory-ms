import { Router } from 'express';
import { Types } from 'mongoose';
import {
  cancelPurchaseOrderRequestSchema,
  createPurchaseOrderRequestSchema,
  rejectPurchaseOrderRequestSchema,
  updatePurchaseOrderRequestSchema,
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
import * as PurchaseOrderService from '../application/PurchaseOrderService.js';
import { toPurchaseOrderDto } from './mappers.js';

export const purchaseOrdersRouter: Router = Router();

purchaseOrdersRouter.use(requireAuth);
purchaseOrdersRouter.use(
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

purchaseOrdersRouter.get(
  '/',
  requirePermission('purchase_orders.view'),
  asyncHandler(async (req, res) => {
    const orders = await PurchaseOrderService.listPurchaseOrders(
      getAuthContext(req).organizationId,
    );
    sendSuccess(res, orders.map(toPurchaseOrderDto));
  }),
);

purchaseOrdersRouter.post(
  '/',
  requirePermission('purchase_orders.create'),
  doubleCsrfProtection,
  validateBody(createPurchaseOrderRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const po = await PurchaseOrderService.createPurchaseOrder(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof PurchaseOrderService.createPurchaseOrder>[1],
    );
    sendSuccess(res, toPurchaseOrderDto(po), 201);
  }),
);

purchaseOrdersRouter.get(
  '/:id',
  requirePermission('purchase_orders.view'),
  asyncHandler(async (req, res) => {
    const po = await PurchaseOrderService.getPurchaseOrderById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toPurchaseOrderDto(po));
  }),
);

purchaseOrdersRouter.patch(
  '/:id',
  requirePermission('purchase_orders.update'),
  doubleCsrfProtection,
  validateBody(updatePurchaseOrderRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const po = await PurchaseOrderService.updatePurchaseOrder(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof PurchaseOrderService.updatePurchaseOrder>[2],
    );
    sendSuccess(res, toPurchaseOrderDto(po));
  }),
);

purchaseOrdersRouter.post(
  '/:id/submit',
  requirePermission('purchase_orders.submit'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const po = await PurchaseOrderService.submitPurchaseOrder(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toPurchaseOrderDto(po));
  }),
);

purchaseOrdersRouter.post(
  '/:id/approve',
  requirePermission('purchase_orders.approve'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const po = await PurchaseOrderService.approvePurchaseOrder(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toPurchaseOrderDto(po));
  }),
);

purchaseOrdersRouter.post(
  '/:id/reject',
  requirePermission('purchase_orders.reject'),
  doubleCsrfProtection,
  validateBody(rejectPurchaseOrderRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { reason } = req.body as { reason: string };
    const po = await PurchaseOrderService.rejectPurchaseOrder(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
    );
    sendSuccess(res, toPurchaseOrderDto(po));
  }),
);

purchaseOrdersRouter.post(
  '/:id/close',
  requirePermission('purchase_orders.close'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const po = await PurchaseOrderService.closePurchaseOrder(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toPurchaseOrderDto(po));
  }),
);

purchaseOrdersRouter.post(
  '/:id/cancel',
  requirePermission('purchase_orders.cancel'),
  doubleCsrfProtection,
  validateBody(cancelPurchaseOrderRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { reason } = req.body as { reason: string };
    const po = await PurchaseOrderService.cancelPurchaseOrder(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      reason,
    );
    sendSuccess(res, toPurchaseOrderDto(po));
  }),
);

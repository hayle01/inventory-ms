import { Router } from 'express';
import { Types } from 'mongoose';
import { createSupplierRequestSchema, updateSupplierRequestSchema } from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { ValidationError } from '../../../shared/http/errors.js';
import * as SupplierService from '../application/SupplierService.js';
import { toSupplierDto } from './mappers.js';

export const suppliersRouter: Router = Router();

suppliersRouter.use(requireAuth);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

suppliersRouter.get(
  '/',
  requirePermission('suppliers.view'),
  asyncHandler(async (req, res) => {
    const suppliers = await SupplierService.listSuppliers(getAuthContext(req).organizationId);
    sendSuccess(res, suppliers.map(toSupplierDto));
  }),
);

suppliersRouter.post(
  '/',
  requirePermission('suppliers.manage'),
  doubleCsrfProtection,
  validateBody(createSupplierRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const supplier = await SupplierService.createSupplier(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof SupplierService.createSupplier>[1],
    );
    sendSuccess(res, toSupplierDto(supplier), 201);
  }),
);

suppliersRouter.get(
  '/:id',
  requirePermission('suppliers.view'),
  asyncHandler(async (req, res) => {
    const supplier = await SupplierService.getSupplierById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toSupplierDto(supplier));
  }),
);

suppliersRouter.patch(
  '/:id',
  requirePermission('suppliers.manage'),
  doubleCsrfProtection,
  validateBody(updateSupplierRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const supplier = await SupplierService.updateSupplier(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof SupplierService.updateSupplier>[2],
    );
    sendSuccess(res, toSupplierDto(supplier));
  }),
);

suppliersRouter.post(
  '/:id/archive',
  requirePermission('suppliers.manage'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const supplier = await SupplierService.archiveSupplier(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toSupplierDto(supplier));
  }),
);

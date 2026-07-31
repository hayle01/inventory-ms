import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createStorageLocationRequestSchema,
  createWarehouseRequestSchema,
  updateStorageLocationRequestSchema,
  updateWarehouseRequestSchema,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { ValidationError } from '../../../shared/http/errors.js';
import * as WarehouseService from '../application/WarehouseService.js';
import * as StorageLocationService from '../application/StorageLocationService.js';
import { toStorageLocationDto, toWarehouseDto } from './mappers.js';

export const warehousesRouter: Router = Router();

warehousesRouter.use(requireAuth);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

warehousesRouter.get(
  '/',
  requirePermission('warehouses.view'),
  asyncHandler(async (req, res) => {
    const warehouses = await WarehouseService.listWarehouses(getAuthContext(req).organizationId);
    sendSuccess(res, warehouses.map(toWarehouseDto));
  }),
);

warehousesRouter.post(
  '/',
  requirePermission('warehouses.manage'),
  doubleCsrfProtection,
  validateBody(createWarehouseRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const warehouse = await WarehouseService.createWarehouse(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof WarehouseService.createWarehouse>[1],
    );
    sendSuccess(res, toWarehouseDto(warehouse), 201);
  }),
);

warehousesRouter.get(
  '/:warehouseId',
  requirePermission('warehouses.view'),
  asyncHandler(async (req, res) => {
    const warehouse = await WarehouseService.getWarehouseById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['warehouseId']),
    );
    sendSuccess(res, toWarehouseDto(warehouse));
  }),
);

warehousesRouter.patch(
  '/:warehouseId',
  requirePermission('warehouses.manage'),
  doubleCsrfProtection,
  validateBody(updateWarehouseRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const warehouse = await WarehouseService.updateWarehouse(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['warehouseId']),
      req.body as Parameters<typeof WarehouseService.updateWarehouse>[2],
    );
    sendSuccess(res, toWarehouseDto(warehouse));
  }),
);

warehousesRouter.post(
  '/:warehouseId/archive',
  requirePermission('warehouses.manage'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const warehouse = await WarehouseService.archiveWarehouse(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['warehouseId']),
    );
    sendSuccess(res, toWarehouseDto(warehouse));
  }),
);

// --- Storage locations (nested under warehouse) -----------------------------

warehousesRouter.get(
  '/:warehouseId/locations',
  requirePermission('warehouses.view'),
  asyncHandler(async (req, res) => {
    const locations = await StorageLocationService.listStorageLocations(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['warehouseId']),
    );
    sendSuccess(res, locations.map(toStorageLocationDto));
  }),
);

warehousesRouter.post(
  '/:warehouseId/locations',
  requirePermission('locations.manage'),
  doubleCsrfProtection,
  validateBody(createStorageLocationRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const location = await StorageLocationService.createStorageLocation(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['warehouseId']),
      req.body as Parameters<typeof StorageLocationService.createStorageLocation>[2],
    );
    sendSuccess(res, toStorageLocationDto(location), 201);
  }),
);

warehousesRouter.get(
  '/:warehouseId/locations/:locationId',
  requirePermission('warehouses.view'),
  asyncHandler(async (req, res) => {
    const location = await StorageLocationService.getStorageLocationById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['warehouseId']),
      parseObjectId(req.params['locationId']),
    );
    sendSuccess(res, toStorageLocationDto(location));
  }),
);

warehousesRouter.patch(
  '/:warehouseId/locations/:locationId',
  requirePermission('locations.manage'),
  doubleCsrfProtection,
  validateBody(updateStorageLocationRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const location = await StorageLocationService.updateStorageLocation(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['warehouseId']),
      parseObjectId(req.params['locationId']),
      req.body as Parameters<typeof StorageLocationService.updateStorageLocation>[3],
    );
    sendSuccess(res, toStorageLocationDto(location));
  }),
);

warehousesRouter.post(
  '/:warehouseId/locations/:locationId/archive',
  requirePermission('locations.manage'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const location = await StorageLocationService.archiveStorageLocation(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['warehouseId']),
      parseObjectId(req.params['locationId']),
    );
    sendSuccess(res, toStorageLocationDto(location));
  }),
);

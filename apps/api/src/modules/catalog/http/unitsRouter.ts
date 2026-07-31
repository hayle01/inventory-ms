import { Router } from 'express';
import { Types } from 'mongoose';
import { createUnitRequestSchema, updateUnitRequestSchema } from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { ValidationError } from '../../../shared/http/errors.js';
import * as UnitService from '../application/UnitService.js';
import { toUnitDto } from './mappers.js';

export const unitsRouter: Router = Router();

unitsRouter.use(requireAuth);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

/**
 * No dedicated `units.view` permission exists in the canonical permission
 * list -- units are low-risk shared reference data used across catalog
 * workflows, so reads are gated by `categories.view` (the closest catalog
 * read permission) rather than inventing a new permission string.
 */
unitsRouter.get(
  '/',
  requirePermission('categories.view'),
  asyncHandler(async (req, res) => {
    const units = await UnitService.listUnits(getAuthContext(req).organizationId);
    sendSuccess(res, units.map(toUnitDto));
  }),
);

unitsRouter.post(
  '/',
  requirePermission('units.manage'),
  doubleCsrfProtection,
  validateBody(createUnitRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const unit = await UnitService.createUnit(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof UnitService.createUnit>[1],
    );
    sendSuccess(res, toUnitDto(unit), 201);
  }),
);

unitsRouter.get(
  '/:id',
  requirePermission('categories.view'),
  asyncHandler(async (req, res) => {
    const unit = await UnitService.getUnitById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toUnitDto(unit));
  }),
);

unitsRouter.patch(
  '/:id',
  requirePermission('units.manage'),
  doubleCsrfProtection,
  validateBody(updateUnitRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const unit = await UnitService.updateUnit(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof UnitService.updateUnit>[2],
    );
    sendSuccess(res, toUnitDto(unit));
  }),
);

unitsRouter.post(
  '/:id/archive',
  requirePermission('units.manage'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const unit = await UnitService.archiveUnit(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toUnitDto(unit));
  }),
);

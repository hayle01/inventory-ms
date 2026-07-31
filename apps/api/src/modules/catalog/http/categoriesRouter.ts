import { Router } from 'express';
import { Types } from 'mongoose';
import { createCategoryRequestSchema, updateCategoryRequestSchema } from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { ValidationError } from '../../../shared/http/errors.js';
import * as CategoryService from '../application/CategoryService.js';
import { toCategoryDto } from './mappers.js';

export const categoriesRouter: Router = Router();

categoriesRouter.use(requireAuth);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

categoriesRouter.get(
  '/',
  requirePermission('categories.view'),
  asyncHandler(async (req, res) => {
    const categories = await CategoryService.listCategories(getAuthContext(req).organizationId);
    sendSuccess(res, categories.map(toCategoryDto));
  }),
);

categoriesRouter.post(
  '/',
  requirePermission('categories.manage'),
  doubleCsrfProtection,
  validateBody(createCategoryRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const category = await CategoryService.createCategory(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof CategoryService.createCategory>[1],
    );
    sendSuccess(res, toCategoryDto(category), 201);
  }),
);

categoriesRouter.get(
  '/:id',
  requirePermission('categories.view'),
  asyncHandler(async (req, res) => {
    const category = await CategoryService.getCategoryById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toCategoryDto(category));
  }),
);

categoriesRouter.patch(
  '/:id',
  requirePermission('categories.manage'),
  doubleCsrfProtection,
  validateBody(updateCategoryRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const category = await CategoryService.updateCategory(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof CategoryService.updateCategory>[2],
    );
    sendSuccess(res, toCategoryDto(category));
  }),
);

categoriesRouter.post(
  '/:id/archive',
  requirePermission('categories.manage'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const category = await CategoryService.archiveCategory(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toCategoryDto(category));
  }),
);

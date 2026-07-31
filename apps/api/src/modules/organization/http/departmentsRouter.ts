import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createDepartmentRequestSchema,
  updateDepartmentRequestSchema,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { ValidationError } from '../../../shared/http/errors.js';
import * as DepartmentService from '../application/DepartmentService.js';
import { toDepartmentDto } from './mappers.js';

export const departmentsRouter: Router = Router();

departmentsRouter.use(requireAuth);

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

departmentsRouter.get(
  '/',
  requirePermission('departments.view'),
  asyncHandler(async (req, res) => {
    const departments = await DepartmentService.listDepartments(getAuthContext(req).organizationId);
    sendSuccess(res, departments.map(toDepartmentDto));
  }),
);

departmentsRouter.post(
  '/',
  requirePermission('departments.manage'),
  doubleCsrfProtection,
  validateBody(createDepartmentRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const department = await DepartmentService.createDepartment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof DepartmentService.createDepartment>[1],
    );
    sendSuccess(res, toDepartmentDto(department), 201);
  }),
);

departmentsRouter.get(
  '/:id',
  requirePermission('departments.view'),
  asyncHandler(async (req, res) => {
    const department = await DepartmentService.getDepartmentById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toDepartmentDto(department));
  }),
);

departmentsRouter.patch(
  '/:id',
  requirePermission('departments.manage'),
  doubleCsrfProtection,
  validateBody(updateDepartmentRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const department = await DepartmentService.updateDepartment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof DepartmentService.updateDepartment>[2],
    );
    sendSuccess(res, toDepartmentDto(department));
  }),
);

departmentsRouter.post(
  '/:id/archive',
  requirePermission('departments.manage'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const department = await DepartmentService.archiveDepartment(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toDepartmentDto(department));
  }),
);

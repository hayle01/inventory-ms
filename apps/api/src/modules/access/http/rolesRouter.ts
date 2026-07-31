import { Router } from 'express';
import { Types } from 'mongoose';
import {
  createRoleRequestSchema,
  updateRoleRequestSchema,
  type RoleDto,
} from '@inventory-ms/contracts';
import { asyncHandler } from '../../../shared/http/asyncHandler.js';
import { sendSuccess } from '../../../shared/http/envelope.js';
import { validateBody } from '../../../shared/http/validate.js';
import { doubleCsrfProtection } from '../../../shared/security/csrf.js';
import { requireAuth } from '../../../shared/security/requireAuth.js';
import { requirePermission } from '../../../shared/security/requirePermission.js';
import { getAuthContext } from '../../../shared/security/authContext.js';
import { ValidationError } from '../../../shared/http/errors.js';
import * as RoleService from '../application/RoleService.js';
import type { RoleDoc } from '../models/Role.js';

export const rolesRouter: Router = Router();

rolesRouter.use(requireAuth);

function toRoleDto(role: RoleDoc): RoleDto {
  return {
    id: role._id.toString(),
    organizationId: role.organizationId.toString(),
    name: role.name,
    description: role.description ?? null,
    permissionNames: role.permissionNames as RoleDto['permissionNames'],
    isSystem: role.isSystem,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
    archivedAt: role.archivedAt ? role.archivedAt.toISOString() : null,
  };
}

function parseObjectId(value: string | undefined): Types.ObjectId {
  try {
    return new Types.ObjectId(value);
  } catch {
    throw new ValidationError('Invalid id.');
  }
}

rolesRouter.get(
  '/',
  requirePermission('roles.view'),
  asyncHandler(async (req, res) => {
    const roles = await RoleService.listRoles(getAuthContext(req).organizationId);
    sendSuccess(res, roles.map(toRoleDto));
  }),
);

rolesRouter.post(
  '/',
  requirePermission('roles.manage'),
  doubleCsrfProtection,
  validateBody(createRoleRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const role = await RoleService.createRole(
      auth.organizationId,
      auth.userId,
      req.body as Parameters<typeof RoleService.createRole>[2],
    );
    sendSuccess(res, toRoleDto(role), 201);
  }),
);

rolesRouter.get(
  '/:id',
  requirePermission('roles.view'),
  asyncHandler(async (req, res) => {
    const role = await RoleService.getRoleById(
      getAuthContext(req).organizationId,
      parseObjectId(req.params['id']),
    );
    sendSuccess(res, toRoleDto(role));
  }),
);

rolesRouter.patch(
  '/:id',
  requirePermission('roles.manage'),
  doubleCsrfProtection,
  validateBody(updateRoleRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const role = await RoleService.updateRole(
      auth.organizationId,
      auth.userId,
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof RoleService.updateRole>[3],
    );
    sendSuccess(res, toRoleDto(role));
  }),
);

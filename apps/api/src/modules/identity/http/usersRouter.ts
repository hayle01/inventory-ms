import { Router } from 'express';
import { Types } from 'mongoose';
import { createUserRequestSchema, updateUserRequestSchema } from '@inventory-ms/contracts';
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
import { RoleModel } from '../../access/models/Role.js';
import * as UserService from '../application/UserService.js';
import { toUserDto } from './mappers.js';

async function loadRoleNamesById(
  organizationId: Types.ObjectId,
  roleIds: readonly Types.ObjectId[],
): Promise<Map<string, string>> {
  const roles = await RoleModel.find({ _id: { $in: roleIds }, organizationId })
    .select({ name: 1 })
    .lean();
  return new Map(roles.map((role) => [role._id.toString(), role.name]));
}

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);
usersRouter.use(
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

usersRouter.get(
  '/',
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const users = await UserService.listUsers(auth.organizationId);
    const allRoleIds = [...new Set(users.flatMap((user) => user.roleIds))];
    const roleNamesById = await loadRoleNamesById(auth.organizationId, allRoleIds);
    sendSuccess(
      res,
      users.map((user) => toUserDto(user, roleNamesById)),
    );
  }),
);

usersRouter.post(
  '/',
  requirePermission('users.create'),
  doubleCsrfProtection,
  validateBody(createUserRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const { user, devInviteToken } = await UserService.createUser(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      req.body as Parameters<typeof UserService.createUser>[1],
    );
    const roleNamesById = await loadRoleNamesById(auth.organizationId, user.roleIds);
    sendSuccess(res, toUserDto(user, roleNamesById, devInviteToken), 201);
  }),
);

usersRouter.get(
  '/:id',
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const user = await UserService.getUserById(
      auth.organizationId,
      parseObjectId(req.params['id']),
    );
    const roleNamesById = await loadRoleNamesById(auth.organizationId, user.roleIds);
    sendSuccess(res, toUserDto(user, roleNamesById));
  }),
);

usersRouter.patch(
  '/:id',
  requirePermission('users.update'),
  doubleCsrfProtection,
  validateBody(updateUserRequestSchema),
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const user = await UserService.updateUser(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      req.body as Parameters<typeof UserService.updateUser>[2],
    );
    const roleNamesById = await loadRoleNamesById(auth.organizationId, user.roleIds);
    sendSuccess(res, toUserDto(user, roleNamesById));
  }),
);

usersRouter.post(
  '/:id/activate',
  requirePermission('users.activate'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const user = await UserService.activateUser(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
    );
    const roleNamesById = await loadRoleNamesById(auth.organizationId, user.roleIds);
    sendSuccess(res, toUserDto(user, roleNamesById));
  }),
);

usersRouter.post(
  '/:id/deactivate',
  requirePermission('users.deactivate'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const body = req.body as { reason?: string };
    const user = await UserService.deactivateUser(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      body.reason,
    );
    const roleNamesById = await loadRoleNamesById(auth.organizationId, user.roleIds);
    sendSuccess(res, toUserDto(user, roleNamesById));
  }),
);

usersRouter.post(
  '/:id/archive',
  requirePermission('users.deactivate'),
  doubleCsrfProtection,
  asyncHandler(async (req, res) => {
    const auth = getAuthContext(req);
    const body = req.body as { reason?: string };
    const user = await UserService.archiveUser(
      {
        organizationId: auth.organizationId,
        actorId: auth.userId,
        correlationId: req.correlationId,
      },
      parseObjectId(req.params['id']),
      body.reason,
    );
    const roleNamesById = await loadRoleNamesById(auth.organizationId, user.roleIds);
    sendSuccess(res, toUserDto(user, roleNamesById));
  }),
);

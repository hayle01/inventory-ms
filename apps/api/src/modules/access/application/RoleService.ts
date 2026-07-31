import type { Types } from 'mongoose';
import {
  isPermission,
  type CreateRoleRequest,
  type UpdateRoleRequest,
} from '@inventory-ms/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { RoleModel, type RoleDoc } from '../models/Role.js';

function assertKnownPermissions(permissionNames: readonly string[]): void {
  const unknown = permissionNames.filter((name) => !isPermission(name));
  if (unknown.length > 0) {
    throw new ValidationError('One or more permission names are not recognized.', { unknown });
  }
}

export async function listRoles(organizationId: Types.ObjectId): Promise<RoleDoc[]> {
  return RoleModel.find({ organizationId, archivedAt: null }).sort({ name: 1 }).lean();
}

export async function getRoleById(
  organizationId: Types.ObjectId,
  roleId: Types.ObjectId,
): Promise<RoleDoc> {
  const role = await RoleModel.findOne({ _id: roleId, organizationId, archivedAt: null }).lean();
  if (!role) throw new NotFoundError('Role not found.');
  return role;
}

export async function createRole(
  organizationId: Types.ObjectId,
  actorId: Types.ObjectId,
  input: CreateRoleRequest,
): Promise<RoleDoc> {
  assertKnownPermissions(input.permissionNames);

  const existing = await RoleModel.findOne({ organizationId, name: input.name }).lean();
  if (existing) throw new ConflictError('A role with this name already exists.');

  const created = await RoleModel.create({
    organizationId,
    name: input.name,
    description: input.description ?? null,
    permissionNames: input.permissionNames,
    isSystem: false,
    createdBy: actorId,
    updatedBy: actorId,
  });
  return created.toObject();
}

export async function updateRole(
  organizationId: Types.ObjectId,
  actorId: Types.ObjectId,
  roleId: Types.ObjectId,
  input: UpdateRoleRequest,
): Promise<RoleDoc> {
  const role = await RoleModel.findOne({ _id: roleId, organizationId, archivedAt: null });
  if (!role) throw new NotFoundError('Role not found.');
  if (role.isSystem) {
    throw new ValidationError('System roles cannot be modified.');
  }
  if (input.permissionNames) assertKnownPermissions(input.permissionNames);

  if (input.name !== undefined) role.name = input.name;
  if (input.description !== undefined) role.description = input.description;
  if (input.permissionNames !== undefined) role.permissionNames = input.permissionNames;
  role.updatedBy = actorId;

  await role.save();
  return role.toObject();
}

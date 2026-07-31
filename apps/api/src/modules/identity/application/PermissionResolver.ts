import type { Types } from 'mongoose';
import { isPermission, type Permission } from '@inventory-ms/contracts';
import { RoleModel } from '../../access/models/Role.js';

export async function resolveEffectivePermissions(
  organizationId: Types.ObjectId,
  roleIds: readonly Types.ObjectId[],
  directPermissionNames: readonly string[],
): Promise<Permission[]> {
  const roles =
    roleIds.length > 0
      ? await RoleModel.find({
          _id: { $in: roleIds },
          organizationId,
          archivedAt: null,
        })
          .select('permissionNames')
          .lean()
      : [];

  const permissions = new Set<Permission>();
  for (const role of roles) {
    for (const name of role.permissionNames) {
      if (isPermission(name)) permissions.add(name);
    }
  }
  for (const name of directPermissionNames) {
    if (isPermission(name)) permissions.add(name);
  }

  return [...permissions];
}

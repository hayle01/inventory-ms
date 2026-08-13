import type { Permission, UserDto } from '@inventory-ms/contracts';
import type { UserDoc } from '../models/User.js';

export function toUserDto(
  user: UserDoc,
  roleNamesById: ReadonlyMap<string, string> = new Map(),
  inviteToken: string | null = null,
): UserDto {
  const roleIds = user.roleIds.map((id) => id.toString());
  return {
    id: user._id.toString(),
    organizationId: user.organizationId.toString(),
    fullName: user.fullName,
    username: user.usernameNormalized,
    email: user.emailNormalized,
    status: user.status,
    departmentId: user.departmentId ? user.departmentId.toString() : null,
    warehouseScopeIds: user.warehouseScopeIds.map((id) => id.toString()),
    roleIds,
    roleNames: roleIds
      .map((id) => roleNamesById.get(id))
      .filter((name): name is string => Boolean(name)),
    directPermissionNames: user.directPermissionNames as Permission[],
    mfaEnabled: user.mfa.enabled,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    inviteToken,
  };
}

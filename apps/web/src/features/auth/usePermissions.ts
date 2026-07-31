import { useMemo } from 'react';
import type { Permission } from '@inventory-ms/contracts';
import { useMe } from './useMe';

export function usePermissions(): {
  permissions: ReadonlySet<Permission>;
  has: (permission: Permission) => boolean;
  hasAny: (permissions: readonly Permission[]) => boolean;
} {
  const me = useMe();
  const permissions = useMemo(() => new Set(me.data?.permissions ?? []), [me.data]);

  return useMemo(
    () => ({
      permissions,
      has: (permission: Permission) => permissions.has(permission),
      hasAny: (list: readonly Permission[]) => list.some((permission) => permissions.has(permission)),
    }),
    [permissions],
  );
}

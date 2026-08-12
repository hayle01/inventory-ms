/**
 * Canonical permission strings. Controllers and UI must reference this list
 * (or roles resolved from it) and must never hard-code role names.
 */
export const PERMISSIONS = [
  'users.view',
  'users.create',
  'users.update',
  'users.activate',
  'users.deactivate',
  'roles.view',
  'roles.manage',
  'permissions.view',
  'organizations.view',
  'organizations.manage',
  'departments.view',
  'departments.manage',
  'warehouses.view',
  'warehouses.manage',
  'locations.manage',
  'products.view',
  'products.create',
  'products.update',
  'products.archive',
  'categories.view',
  'categories.manage',
  'units.manage',
  'suppliers.view',
  'suppliers.manage',
  'purchase_orders.view',
  'purchase_orders.create',
  'purchase_orders.update',
  'purchase_orders.submit',
  'purchase_orders.approve',
  'purchase_orders.reject',
  'purchase_orders.cancel',
  'receipts.view',
  'receipts.create',
  'receipts.update',
  'receipts.verify',
  'receipts.post',
  'receipts.reverse',
  'stock_requests.view',
  'stock_requests.create',
  'stock_requests.update',
  'stock_requests.submit',
  'stock_requests.approve',
  'stock_requests.reject',
  'stock_requests.cancel',
  'issues.view',
  'issues.create',
  'issues.update',
  'issues.pick',
  'issues.post',
  'issues.reverse',
  'returns.view',
  'returns.create',
  'returns.post',
  'transfers.view',
  'transfers.create',
  'transfers.submit',
  'transfers.approve',
  'transfers.post',
  'transfers.reverse',
  'adjustments.view',
  'adjustments.create',
  'adjustments.submit',
  'adjustments.approve',
  'adjustments.reject',
  'adjustments.post',
  'adjustments.reverse',
  'stock_counts.view',
  'stock_counts.create',
  'stock_counts.submit',
  'stock_counts.approve',
  'stock_counts.reject',
  'stock_counts.post',
  'stock_counts.reverse',
  'inventory.view',
  'inventory.reconcile',
  'alerts.view',
  'alerts.acknowledge',
  'alerts.resolve',
  'reports.view',
  'reports.export',
  'audit.view',
  'settings.manage',
  'operations.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_SET: ReadonlySet<Permission> = new Set(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value as Permission);
}

/**
 * System (non-deletable) role names seeded at bootstrap. These are seed
 * labels only -- authorization logic must check permissions, never these
 * names, at the controller layer.
 */
export const SYSTEM_ROLE_NAMES = [
  'Administrator',
  'Store Manager',
  'Inventory Clerk',
  'Requester',
  'Auditor',
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

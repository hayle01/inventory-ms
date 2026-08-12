import { PERMISSIONS, SYSTEM_ROLE_NAMES, type Permission } from '@inventory-ms/contracts';

export type RiskLevel = 'low' | 'medium' | 'high';

const HIGH_RISK_SUFFIXES = [
  'approve',
  'post',
  'reverse',
  'manage',
  'deactivate',
  'archive',
  'cancel',
  'reject',
];
const MEDIUM_RISK_SUFFIXES = [
  'create',
  'update',
  'submit',
  'activate',
  'acknowledge',
  'resolve',
  'reconcile',
  'pick',
  'verify',
  'export',
];

export function moduleForPermission(permission: Permission): string {
  const [moduleName] = permission.split('.');
  return moduleName ?? permission;
}

export function riskLevelForPermission(permission: Permission): RiskLevel {
  const action = permission.split('.').slice(1).join('.');
  if (HIGH_RISK_SUFFIXES.includes(action)) return 'high';
  if (MEDIUM_RISK_SUFFIXES.includes(action)) return 'medium';
  return 'low';
}

export interface PermissionCatalogEntry {
  name: Permission;
  description: string;
  module: string;
  riskLevel: RiskLevel;
}

/** The full permission catalog, derived once from the canonical list in @inventory-ms/contracts. */
export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = PERMISSIONS.map((name) => ({
  name,
  description: humanizePermission(name),
  module: moduleForPermission(name),
  riskLevel: riskLevelForPermission(name),
}));

function humanizePermission(permission: Permission): string {
  const [module, action] = permission.split('.');
  return `${String(action)} access for ${String(module).replace(/_/g, ' ')}`;
}

/**
 * Default permission bundles for the seeded system roles. Administrator gets
 * every permission; the rest are deliberately conservative starting points
 * an organization can customize post-seed.
 */
export const SYSTEM_ROLE_PERMISSIONS: Readonly<
  Record<(typeof SYSTEM_ROLE_NAMES)[number], readonly Permission[]>
> = {
  Administrator: PERMISSIONS,
  'Store Manager': [
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
    'receipts.verify',
    'receipts.post',
    'stock_requests.view',
    'stock_requests.approve',
    'stock_requests.reject',
    'issues.view',
    'issues.post',
    'transfers.view',
    'transfers.approve',
    'adjustments.view',
    'adjustments.approve',
    'adjustments.reject',
    'adjustments.post',
    'adjustments.reverse',
    'stock_counts.view',
    'stock_counts.approve',
    'stock_counts.reject',
    'stock_counts.post',
    'stock_counts.reverse',
    'inventory.view',
    'alerts.view',
    'alerts.acknowledge',
    'alerts.resolve',
    'reports.view',
    'reports.export',
    'warehouses.view',
    'departments.view',
  ],
  'Inventory Clerk': [
    'products.view',
    'suppliers.view',
    'receipts.view',
    'receipts.create',
    'receipts.update',
    'receipts.verify',
    'stock_requests.view',
    'issues.view',
    'issues.create',
    'issues.pick',
    'issues.post',
    'returns.view',
    'returns.create',
    'returns.post',
    'transfers.view',
    'transfers.create',
    'transfers.submit',
    'adjustments.view',
    'adjustments.create',
    'adjustments.submit',
    'stock_counts.view',
    'stock_counts.create',
    'stock_counts.submit',
    'inventory.view',
    'alerts.view',
    'warehouses.view',
  ],
  Requester: [
    'products.view',
    'inventory.view',
    'stock_requests.view',
    'stock_requests.create',
    'stock_requests.update',
    'stock_requests.submit',
    'stock_requests.cancel',
  ],
  Auditor: [
    'products.view',
    'suppliers.view',
    'purchase_orders.view',
    'receipts.view',
    'stock_requests.view',
    'issues.view',
    'returns.view',
    'transfers.view',
    'adjustments.view',
    'stock_counts.view',
    'inventory.view',
    'alerts.view',
    'reports.view',
    'audit.view',
    'operations.view',
  ],
};

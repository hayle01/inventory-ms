import type { Permission } from '@inventory-ms/contracts';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Building,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  History,
  KeyRound,
  Package,
  PackageCheck,
  PackageSearch,
  PenSquare,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface AppModuleGroup {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind background class shared by every tile in this group -- color identifies the group, icon identifies the module. */
  tint: string;
}

export const APP_MODULE_GROUPS: readonly AppModuleGroup[] = [
  {
    key: 'access',
    label: 'Users & Access',
    description: 'Accounts, roles, and the permission catalog',
    icon: ShieldCheck,
    tint: 'bg-indigo-600',
  },
  {
    key: 'organization',
    label: 'Organization',
    description: 'Company profile, departments, and warehouses',
    icon: Building,
    tint: 'bg-slate-600',
  },
  {
    key: 'catalog',
    label: 'Catalog',
    description: 'Products, categories, and units of measure',
    icon: Package,
    tint: 'bg-amber-600',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    description: 'The vendor directory',
    icon: Truck,
    tint: 'bg-orange-600',
  },
  {
    key: 'procurement',
    label: 'Procurement',
    description: 'Purchase orders',
    icon: ShoppingCart,
    tint: 'bg-blue-600',
  },
  {
    key: 'receiving',
    label: 'Receiving',
    description: 'Goods receipts against purchase orders',
    icon: PackageCheck,
    tint: 'bg-lime-600',
  },
  {
    key: 'requests',
    label: 'Requests & Issues',
    description: 'Stock requests, picking, issuing, and returns',
    icon: ClipboardCheck,
    tint: 'bg-sky-600',
  },
  {
    key: 'adjustments',
    label: 'Adjustments & Counts',
    description: 'Quantity corrections and cycle/full counts',
    icon: PenSquare,
    tint: 'bg-fuchsia-600',
  },
  {
    key: 'transfers',
    label: 'Transfers',
    description: 'Stock moved between warehouses or locations',
    icon: ArrowLeftRight,
    tint: 'bg-cyan-600',
  },
  {
    key: 'insights',
    label: 'Reports & Insights',
    description: 'Analytics across the ledger and audit trail',
    icon: BarChart3,
    tint: 'bg-violet-600',
  },
] as const;

export interface AppModule {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  group: (typeof APP_MODULE_GROUPS)[number]['key'];
  requiredPermission: Permission;
}

export const APP_MODULES: readonly AppModule[] = [
  // -- Users & Access ----------------------------------------------------
  {
    key: 'users',
    label: 'Users',
    description: 'People and accounts',
    href: '/apps/users',
    icon: ShieldCheck,
    group: 'access',
    requiredPermission: 'users.view',
  },
  {
    key: 'roles',
    label: 'Roles',
    description: 'Permission bundles',
    href: '/apps/roles',
    icon: ShieldCheck,
    group: 'access',
    requiredPermission: 'roles.view',
  },
  {
    key: 'permissions',
    label: 'Permissions',
    description: 'Access catalog',
    href: '/apps/permissions',
    icon: KeyRound,
    group: 'access',
    requiredPermission: 'permissions.view',
  },
  // -- Organization --------------------------------------------------------
  {
    key: 'organization',
    label: 'Organization',
    description: 'Company profile',
    href: '/apps/organization',
    icon: Building,
    group: 'organization',
    requiredPermission: 'organizations.view',
  },
  {
    key: 'departments',
    label: 'Departments',
    description: 'Requesting units',
    href: '/apps/departments',
    icon: Building,
    group: 'organization',
    requiredPermission: 'departments.view',
  },
  {
    key: 'warehouses',
    label: 'Warehouses',
    description: 'Storage locations',
    href: '/apps/warehouses',
    icon: Building,
    group: 'organization',
    requiredPermission: 'warehouses.view',
  },
  // -- Catalog ---------------------------------------------------------------
  {
    key: 'categories',
    label: 'Categories',
    description: 'Product grouping',
    href: '/apps/categories',
    icon: Package,
    group: 'catalog',
    requiredPermission: 'categories.view',
  },
  {
    key: 'units',
    label: 'Units',
    description: 'Measurement units',
    href: '/apps/units',
    icon: Package,
    group: 'catalog',
    requiredPermission: 'categories.view',
  },
  {
    key: 'products',
    label: 'Products',
    description: 'Catalog items',
    href: '/apps/products',
    icon: Package,
    group: 'catalog',
    requiredPermission: 'products.view',
  },
  // -- Suppliers ---------------------------------------------------------------
  {
    key: 'suppliers',
    label: 'Suppliers',
    description: 'Vendor directory',
    href: '/apps/suppliers',
    icon: Truck,
    group: 'suppliers',
    requiredPermission: 'suppliers.view',
  },
  // -- Procurement ---------------------------------------------------------
  {
    key: 'purchase-orders',
    label: 'Purchase Orders',
    description: 'Procurement',
    href: '/apps/purchase-orders',
    icon: ShoppingCart,
    group: 'procurement',
    requiredPermission: 'purchase_orders.view',
  },
  // -- Receiving ------------------------------------------------------------
  {
    key: 'goods-receipts',
    label: 'Goods Receipts',
    description: 'Receiving',
    href: '/apps/goods-receipts',
    icon: PackageCheck,
    group: 'receiving',
    requiredPermission: 'receipts.view',
  },
  // -- Requests & Issues ---------------------------------------------------
  {
    key: 'stock-requests',
    label: 'Stock Requests',
    description: 'Requests and approvals',
    href: '/apps/stock-requests',
    icon: ClipboardCheck,
    group: 'requests',
    requiredPermission: 'stock_requests.view',
  },
  {
    key: 'stock-issues',
    label: 'Stock Issues',
    description: 'Picking and issuing',
    href: '/apps/stock-issues',
    icon: ClipboardCheck,
    group: 'requests',
    requiredPermission: 'issues.view',
  },
  {
    key: 'stock-returns',
    label: 'Stock Returns',
    description: 'Returned stock',
    href: '/apps/stock-returns',
    icon: ClipboardCheck,
    group: 'requests',
    requiredPermission: 'returns.view',
  },
  // -- Adjustments & Counts -------------------------------------------------
  {
    key: 'stock-adjustments',
    label: 'Stock Adjustments',
    description: 'Quantity corrections',
    href: '/apps/stock-adjustments',
    icon: PenSquare,
    group: 'adjustments',
    requiredPermission: 'adjustments.view',
  },
  {
    key: 'stock-counts',
    label: 'Stock Counts',
    description: 'Cycle and full counts',
    href: '/apps/stock-counts',
    icon: PenSquare,
    group: 'adjustments',
    requiredPermission: 'stock_counts.view',
  },
  // -- Transfers -----------------------------------------------------------
  {
    key: 'stock-transfers',
    label: 'Stock Transfers',
    description: 'Between warehouses',
    href: '/apps/stock-transfers',
    icon: ArrowLeftRight,
    group: 'transfers',
    requiredPermission: 'transfers.view',
  },
  // -- Reports & Insights ----------------------------------------------------
  {
    key: 'reports-inventory',
    label: 'Inventory & Valuation',
    description: 'On-hand, reserved, available, cost',
    href: '/apps/reports/inventory',
    icon: Warehouse,
    group: 'insights',
    requiredPermission: 'reports.view',
  },
  {
    key: 'reports-stock-movement',
    label: 'Stock Movement',
    description: 'Every ledger transaction',
    href: '/apps/reports/stock-movement',
    icon: History,
    group: 'insights',
    requiredPermission: 'reports.view',
  },
  {
    key: 'reports-purchases',
    label: 'Purchases & Suppliers',
    description: 'Purchase orders and spend',
    href: '/apps/reports/purchases',
    icon: ShoppingCart,
    group: 'insights',
    requiredPermission: 'reports.view',
  },
  {
    key: 'reports-issues',
    label: 'Requests, Issues & Returns',
    description: 'Fulfillment activity',
    href: '/apps/reports/issues',
    icon: ClipboardList,
    group: 'insights',
    requiredPermission: 'reports.view',
  },
  {
    key: 'reports-low-stock',
    label: 'Low & Out of Stock',
    description: 'At or below reorder level',
    href: '/apps/reports/low-stock',
    icon: PackageSearch,
    group: 'insights',
    requiredPermission: 'reports.view',
  },
  {
    key: 'reports-expiry',
    label: 'Expiring & Expired',
    description: 'Lots nearing or past expiry',
    href: '/apps/reports/expiry',
    icon: CalendarClock,
    group: 'insights',
    requiredPermission: 'reports.view',
  },
  {
    key: 'reports-audit',
    label: 'Audit Trail',
    description: 'Actor, action, resource, outcome',
    href: '/apps/reports/audit',
    icon: AlertTriangle,
    group: 'insights',
    requiredPermission: 'audit.view',
  },
] as const;

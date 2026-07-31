import type { Permission } from '@inventory-ms/contracts';
import {
  Building,
  Building2,
  ClipboardList,
  KeyRound,
  Package,
  Ruler,
  ShieldCheck,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface AppModule {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Tailwind background classes for the tile icon -- each module gets a distinct accent. */
  tint: string;
  requiredPermission: Permission;
}

export const APP_MODULES: readonly AppModule[] = [
  {
    key: 'users',
    label: 'Users',
    description: 'People and accounts',
    href: '/apps/users',
    icon: Users,
    tint: 'bg-blue-500',
    requiredPermission: 'users.view',
  },
  {
    key: 'roles',
    label: 'Roles',
    description: 'Permission bundles',
    href: '/apps/roles',
    icon: ShieldCheck,
    tint: 'bg-violet-500',
    requiredPermission: 'roles.view',
  },
  {
    key: 'permissions',
    label: 'Permissions',
    description: 'Access catalog',
    href: '/apps/permissions',
    icon: KeyRound,
    tint: 'bg-fuchsia-500',
    requiredPermission: 'permissions.view',
  },
  {
    key: 'organization',
    label: 'Organization',
    description: 'Company profile',
    href: '/apps/organization',
    icon: Building,
    tint: 'bg-slate-600',
    requiredPermission: 'organizations.view',
  },
  {
    key: 'departments',
    label: 'Departments',
    description: 'Requesting units',
    href: '/apps/departments',
    icon: Building2,
    tint: 'bg-cyan-600',
    requiredPermission: 'departments.view',
  },
  {
    key: 'warehouses',
    label: 'Warehouses',
    description: 'Storage locations',
    href: '/apps/warehouses',
    icon: Warehouse,
    tint: 'bg-amber-600',
    requiredPermission: 'warehouses.view',
  },
  {
    key: 'categories',
    label: 'Categories',
    description: 'Product grouping',
    href: '/apps/categories',
    icon: Tags,
    tint: 'bg-rose-500',
    requiredPermission: 'categories.view',
  },
  {
    key: 'units',
    label: 'Units',
    description: 'Measurement units',
    href: '/apps/units',
    icon: Ruler,
    tint: 'bg-teal-600',
    requiredPermission: 'categories.view',
  },
  {
    key: 'products',
    label: 'Products',
    description: 'Catalog items',
    href: '/apps/products',
    icon: Package,
    tint: 'bg-orange-600',
    requiredPermission: 'products.view',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    description: 'Vendor directory',
    href: '/apps/suppliers',
    icon: Truck,
    tint: 'bg-emerald-600',
    requiredPermission: 'suppliers.view',
  },
  {
    key: 'purchase-orders',
    label: 'Purchase Orders',
    description: 'Procurement',
    href: '/apps/purchase-orders',
    icon: ClipboardList,
    tint: 'bg-indigo-600',
    requiredPermission: 'purchase_orders.view',
  },
] as const;

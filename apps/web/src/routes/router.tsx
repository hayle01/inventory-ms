import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { AppLauncherPage } from '../features/launcher/AppLauncherPage';
import { UsersPage } from '../features/users/UsersPage';
import { UserFormPage } from '../features/users/UserFormPage';
import { RolesPage } from '../features/roles/RolesPage';
import { RoleFormPage } from '../features/roles/RoleFormPage';
import { PermissionsPage } from '../features/permissions/PermissionsPage';
import { OrganizationPage } from '../features/organization/OrganizationPage';
import { DepartmentsPage } from '../features/departments/DepartmentsPage';
import { WarehousesPage } from '../features/warehouses/WarehousesPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { UnitsPage } from '../features/units/UnitsPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { ProductFormPage } from '../features/products/ProductFormPage';
import { SuppliersPage } from '../features/suppliers/SuppliersPage';
import { SupplierFormPage } from '../features/suppliers/SupplierFormPage';
import { PurchaseOrdersPage } from '../features/purchase-orders/PurchaseOrdersPage';
import { PurchaseOrderDetailPage } from '../features/purchase-orders/PurchaseOrderDetailPage';
import { PurchaseOrderFormPage } from '../features/purchase-orders/PurchaseOrderFormPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/apps" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/apps',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AppLauncherPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/new', element: <UserFormPage /> },
      { path: 'users/:id/edit', element: <UserFormPage /> },
      { path: 'roles', element: <RolesPage /> },
      { path: 'roles/new', element: <RoleFormPage /> },
      { path: 'roles/:id/edit', element: <RoleFormPage /> },
      { path: 'permissions', element: <PermissionsPage /> },
      { path: 'organization', element: <OrganizationPage /> },
      { path: 'departments', element: <DepartmentsPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'units', element: <UnitsPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/new', element: <ProductFormPage /> },
      { path: 'products/:id/edit', element: <ProductFormPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'suppliers/new', element: <SupplierFormPage /> },
      { path: 'suppliers/:id/edit', element: <SupplierFormPage /> },
      { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
      { path: 'purchase-orders/new', element: <PurchaseOrderFormPage /> },
      { path: 'purchase-orders/:id', element: <PurchaseOrderDetailPage /> },
      { path: 'purchase-orders/:id/edit', element: <PurchaseOrderFormPage /> },
    ],
  },
]);

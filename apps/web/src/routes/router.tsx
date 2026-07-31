import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { AppLauncherPage } from '../features/launcher/AppLauncherPage';
import { UsersPage } from '../features/users/UsersPage';
import { RolesPage } from '../features/roles/RolesPage';
import { PermissionsPage } from '../features/permissions/PermissionsPage';
import { OrganizationPage } from '../features/organization/OrganizationPage';
import { DepartmentsPage } from '../features/departments/DepartmentsPage';
import { WarehousesPage } from '../features/warehouses/WarehousesPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { UnitsPage } from '../features/units/UnitsPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { SuppliersPage } from '../features/suppliers/SuppliersPage';
import { PurchaseOrdersPage } from '../features/purchase-orders/PurchaseOrdersPage';
import { PurchaseOrderDetailPage } from '../features/purchase-orders/PurchaseOrderDetailPage';

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
      { path: 'roles', element: <RolesPage /> },
      { path: 'permissions', element: <PermissionsPage /> },
      { path: 'organization', element: <OrganizationPage /> },
      { path: 'departments', element: <DepartmentsPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'units', element: <UnitsPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'purchase-orders', element: <PurchaseOrdersPage /> },
      { path: 'purchase-orders/:id', element: <PurchaseOrderDetailPage /> },
    ],
  },
]);

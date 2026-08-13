import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteErrorBoundary } from '../components/errors/RouteErrorBoundary';
import { LoginPage } from '../features/auth/LoginPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { VerifyResetCodePage } from '../features/auth/VerifyResetCodePage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { ProfilePage } from '../features/auth/ProfilePage';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { PublicOnlyRoute } from '../components/PublicOnlyRoute';
import { AppShell } from '../components/layout/AppShell';
import { AppLauncherPage } from '../features/launcher/AppLauncherPage';
import { ApprovalsPage } from '../features/approvals/ApprovalsPage';
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
import { GoodsReceiptsPage } from '../features/goods-receipts/GoodsReceiptsPage';
import { GoodsReceiptDetailPage } from '../features/goods-receipts/GoodsReceiptDetailPage';
import { GoodsReceiptFormPage } from '../features/goods-receipts/GoodsReceiptFormPage';
import { StockRequestsPage } from '../features/stock-requests/StockRequestsPage';
import { StockRequestDetailPage } from '../features/stock-requests/StockRequestDetailPage';
import { StockRequestFormPage } from '../features/stock-requests/StockRequestFormPage';
import { StockIssuesPage } from '../features/stock-issues/StockIssuesPage';
import { StockIssueDetailPage } from '../features/stock-issues/StockIssueDetailPage';
import { StockReturnsPage } from '../features/stock-returns/StockReturnsPage';
import { StockReturnDetailPage } from '../features/stock-returns/StockReturnDetailPage';
import { StockReturnFormPage } from '../features/stock-returns/StockReturnFormPage';
import { StockAdjustmentsPage } from '../features/stock-adjustments/StockAdjustmentsPage';
import { StockAdjustmentDetailPage } from '../features/stock-adjustments/StockAdjustmentDetailPage';
import { StockAdjustmentFormPage } from '../features/stock-adjustments/StockAdjustmentFormPage';
import { StockTransfersPage } from '../features/stock-transfers/StockTransfersPage';
import { StockTransferDetailPage } from '../features/stock-transfers/StockTransferDetailPage';
import { StockTransferFormPage } from '../features/stock-transfers/StockTransferFormPage';
import { StockCountsPage } from '../features/stock-counts/StockCountsPage';
import { StockCountDetailPage } from '../features/stock-counts/StockCountDetailPage';
import { StockCountFormPage } from '../features/stock-counts/StockCountFormPage';
import { InventoryReportPage } from '../features/reports/InventoryReportPage';
import { StockMovementReportPage } from '../features/reports/StockMovementReportPage';
import { PurchasesReportPage } from '../features/reports/PurchasesReportPage';
import { IssuesReportPage } from '../features/reports/IssuesReportPage';
import { LowStockReportPage } from '../features/reports/LowStockReportPage';
import { ExpiryReportPage } from '../features/reports/ExpiryReportPage';
import { AuditReportPage } from '../features/reports/AuditReportPage';

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: <Navigate to="/apps" replace /> },
      {
        path: '/login',
        element: (
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        ),
      },
      {
        path: '/verify-code',
        element: (
          <PublicOnlyRoute>
            <VerifyResetCodePage />
          </PublicOnlyRoute>
        ),
      },
      // Not wrapped in PublicOnlyRoute -- a reset link must work whether or
      // not the browser happens to still have an active session (e.g. an
      // admin resetting a different user's password from an incognito tab,
      // or a stale reset link opened while already logged in).
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        path: '/apps',
        element: (
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <AppLauncherPage /> },
          { path: 'approvals', element: <ApprovalsPage /> },
          { path: 'profile', element: <ProfilePage /> },
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
          { path: 'goods-receipts', element: <GoodsReceiptsPage /> },
          { path: 'goods-receipts/new', element: <GoodsReceiptFormPage /> },
          { path: 'goods-receipts/:id', element: <GoodsReceiptDetailPage /> },
          { path: 'goods-receipts/:id/edit', element: <GoodsReceiptFormPage /> },
          { path: 'stock-requests', element: <StockRequestsPage /> },
          { path: 'stock-requests/new', element: <StockRequestFormPage /> },
          { path: 'stock-requests/:id', element: <StockRequestDetailPage /> },
          { path: 'stock-requests/:id/edit', element: <StockRequestFormPage /> },
          { path: 'stock-issues', element: <StockIssuesPage /> },
          { path: 'stock-issues/:id', element: <StockIssueDetailPage /> },
          { path: 'stock-returns', element: <StockReturnsPage /> },
          { path: 'stock-returns/new', element: <StockReturnFormPage /> },
          { path: 'stock-returns/:id', element: <StockReturnDetailPage /> },
          { path: 'stock-adjustments', element: <StockAdjustmentsPage /> },
          { path: 'stock-adjustments/new', element: <StockAdjustmentFormPage /> },
          { path: 'stock-adjustments/:id', element: <StockAdjustmentDetailPage /> },
          { path: 'stock-adjustments/:id/edit', element: <StockAdjustmentFormPage /> },
          { path: 'stock-transfers', element: <StockTransfersPage /> },
          { path: 'stock-transfers/new', element: <StockTransferFormPage /> },
          { path: 'stock-transfers/:id', element: <StockTransferDetailPage /> },
          { path: 'stock-counts', element: <StockCountsPage /> },
          { path: 'stock-counts/new', element: <StockCountFormPage /> },
          { path: 'stock-counts/:id', element: <StockCountDetailPage /> },
          { path: 'reports', element: <Navigate to="/apps/reports/inventory" replace /> },
          { path: 'reports/inventory', element: <InventoryReportPage /> },
          { path: 'reports/stock-movement', element: <StockMovementReportPage /> },
          { path: 'reports/purchases', element: <PurchasesReportPage /> },
          { path: 'reports/issues', element: <IssuesReportPage /> },
          { path: 'reports/low-stock', element: <LowStockReportPage /> },
          { path: 'reports/expiry', element: <ExpiryReportPage /> },
          { path: 'reports/audit', element: <AuditReportPage /> },
        ],
      },
    ],
  },
]);

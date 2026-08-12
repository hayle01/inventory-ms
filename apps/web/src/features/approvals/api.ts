import { usePermissions } from '@/features/auth/usePermissions';
import { usePurchaseOrders } from '@/features/purchase-orders/api';
import { useStockRequests } from '@/features/stock-requests/api';
import { useStockAdjustments } from '@/features/stock-adjustments/api';
import { useStockTransfers } from '@/features/stock-transfers/api';
import { useStockCounts } from '@/features/stock-counts/api';

export interface PendingApproval {
  id: string;
  documentType: string;
  number: string;
  href: string;
  createdAt: string;
}

/**
 * Aggregates every `submitted` document across modules that the current
 * user can approve, so "what's waiting on me" doesn't require checking each
 * module's list separately. Each module's own list endpoint already scopes
 * to the organization and enforces `<module>.view`; this hook only fetches
 * a module's list at all when the user holds both `.view` and `.approve`
 * for it (holding only `.view` would fetch data the user can't act on here).
 */
export function usePendingApprovals(): {
  isLoading: boolean;
  items: PendingApproval[];
} {
  const { has } = usePermissions();

  const canApprovePurchaseOrders = has('purchase_orders.view') && has('purchase_orders.approve');
  const canApproveStockRequests = has('stock_requests.view') && has('stock_requests.approve');
  const canApproveAdjustments = has('adjustments.view') && has('adjustments.approve');
  const canApproveTransfers = has('transfers.view') && has('transfers.approve');
  const canApproveCounts = has('stock_counts.view') && has('stock_counts.approve');

  const purchaseOrders = usePurchaseOrders({ enabled: canApprovePurchaseOrders });
  const stockRequests = useStockRequests({ enabled: canApproveStockRequests });
  const adjustments = useStockAdjustments({ enabled: canApproveAdjustments });
  const transfers = useStockTransfers({ enabled: canApproveTransfers });
  const counts = useStockCounts({ enabled: canApproveCounts });

  const items: PendingApproval[] = [
    ...(canApprovePurchaseOrders ? (purchaseOrders.data ?? []) : [])
      .filter((po) => po.status === 'submitted')
      .map((po) => ({
        id: po.id,
        documentType: 'Purchase order',
        number: po.poNumber,
        href: `/apps/purchase-orders/${po.id}`,
        createdAt: po.createdAt,
      })),
    ...(canApproveStockRequests ? (stockRequests.data ?? []) : [])
      .filter((request) => request.status === 'submitted')
      .map((request) => ({
        id: request.id,
        documentType: 'Stock request',
        number: request.requestNumber,
        href: `/apps/stock-requests/${request.id}`,
        createdAt: request.createdAt,
      })),
    ...(canApproveAdjustments ? (adjustments.data ?? []) : [])
      .filter((adjustment) => adjustment.status === 'submitted')
      .map((adjustment) => ({
        id: adjustment.id,
        documentType: 'Stock adjustment',
        number: adjustment.adjustmentNumber,
        href: `/apps/stock-adjustments/${adjustment.id}`,
        createdAt: adjustment.createdAt,
      })),
    ...(canApproveTransfers ? (transfers.data ?? []) : [])
      .filter((transfer) => transfer.status === 'submitted')
      .map((transfer) => ({
        id: transfer.id,
        documentType: 'Stock transfer',
        number: transfer.transferNumber,
        href: `/apps/stock-transfers/${transfer.id}`,
        createdAt: transfer.createdAt,
      })),
    ...(canApproveCounts ? (counts.data ?? []) : [])
      .filter((count) => count.status === 'submitted')
      .map((count) => ({
        id: count.id,
        documentType: 'Stock count',
        number: count.countNumber,
        href: `/apps/stock-counts/${count.id}`,
        createdAt: count.createdAt,
      })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const isLoading =
    (canApprovePurchaseOrders && purchaseOrders.isLoading) ||
    (canApproveStockRequests && stockRequests.isLoading) ||
    (canApproveAdjustments && adjustments.isLoading) ||
    (canApproveTransfers && transfers.isLoading) ||
    (canApproveCounts && counts.isLoading);

  return { isLoading, items };
}

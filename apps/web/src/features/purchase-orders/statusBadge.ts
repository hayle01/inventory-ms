import type { PurchaseOrderStatus } from '@inventory-ms/contracts';

export const PO_STATUS_VARIANT: Record<
  PurchaseOrderStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  submitted: 'warning',
  approved: 'success',
  rejected: 'destructive',
  partially_received: 'warning',
  fully_received: 'success',
  closed: 'muted',
  cancelled: 'destructive',
};

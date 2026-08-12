import type { StockRequestStatus } from '@inventory-ms/contracts';

export const STOCK_REQUEST_STATUS_VARIANT: Record<
  StockRequestStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  submitted: 'warning',
  approved: 'success',
  rejected: 'destructive',
  partially_fulfilled: 'warning',
  fulfilled: 'success',
  cancelled: 'muted',
};

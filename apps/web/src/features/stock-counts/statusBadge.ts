import type { StockCountStatus } from '@inventory-ms/contracts';

export const STOCK_COUNT_STATUS_VARIANT: Record<
  StockCountStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  submitted: 'warning',
  approved: 'warning',
  rejected: 'destructive',
  posted: 'success',
  reversed: 'muted',
};

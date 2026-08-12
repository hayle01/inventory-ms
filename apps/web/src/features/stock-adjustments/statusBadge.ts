import type { StockAdjustmentStatus } from '@inventory-ms/contracts';

export const STOCK_ADJUSTMENT_STATUS_VARIANT: Record<
  StockAdjustmentStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  submitted: 'warning',
  approved: 'warning',
  rejected: 'destructive',
  posted: 'success',
  reversed: 'muted',
};

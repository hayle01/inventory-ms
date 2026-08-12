import type { StockTransferStatus } from '@inventory-ms/contracts';

export const STOCK_TRANSFER_STATUS_VARIANT: Record<
  StockTransferStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  submitted: 'warning',
  approved: 'warning',
  in_transit: 'warning',
  completed: 'success',
  reversed: 'muted',
};

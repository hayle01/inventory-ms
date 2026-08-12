import type { StockReturnStatus } from '@inventory-ms/contracts';

export const STOCK_RETURN_STATUS_VARIANT: Record<
  StockReturnStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  posted: 'success',
};

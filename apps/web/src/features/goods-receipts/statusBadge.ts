import type { GoodsReceiptStatus } from '@inventory-ms/contracts';

export const RECEIPT_STATUS_VARIANT: Record<
  GoodsReceiptStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  verified: 'warning',
  posted: 'success',
  reversed: 'muted',
};

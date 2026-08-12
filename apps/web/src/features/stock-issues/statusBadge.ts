import type { StockIssueStatus } from '@inventory-ms/contracts';

export const STOCK_ISSUE_STATUS_VARIANT: Record<
  StockIssueStatus,
  'success' | 'warning' | 'destructive' | 'muted' | 'outline'
> = {
  draft: 'outline',
  picked: 'warning',
  posted: 'success',
  reversed: 'muted',
  cancelled: 'muted',
};

import type { StockIssueStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/** Stock issue state machine (SYSTEM_DOCUMENTATION.md section 9.4). */
const ALLOWED_TRANSITIONS: Readonly<Record<StockIssueStatus, readonly StockIssueStatus[]>> = {
  draft: ['picked', 'cancelled'],
  picked: ['posted', 'cancelled'],
  posted: ['reversed'],
  reversed: [],
  cancelled: [],
};

export function canTransitionStockIssueStatus(
  from: StockIssueStatus,
  to: StockIssueStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStockIssueTransition(from: StockIssueStatus, to: StockIssueStatus): void {
  if (!canTransitionStockIssueStatus(from, to)) {
    throw new BusinessRuleError(`Stock issue cannot move from "${from}" to "${to}".`);
  }
}

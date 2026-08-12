import type { StockCountStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/** Stock count state machine (SYSTEM_DOCUMENTATION.md section 9.5, shared with Adjustments). */
const ALLOWED_TRANSITIONS: Readonly<Record<StockCountStatus, readonly StockCountStatus[]>> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['posted'],
  rejected: [],
  posted: ['reversed'],
  reversed: [],
};

export function canTransitionStockCountStatus(
  from: StockCountStatus,
  to: StockCountStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStockCountTransition(from: StockCountStatus, to: StockCountStatus): void {
  if (!canTransitionStockCountStatus(from, to)) {
    throw new BusinessRuleError(`Stock count cannot move from "${from}" to "${to}".`);
  }
}

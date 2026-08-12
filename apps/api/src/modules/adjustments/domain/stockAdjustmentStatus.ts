import type { StockAdjustmentStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/** Stock adjustment state machine (SYSTEM_DOCUMENTATION.md section 9.5). No cancel branch. */
const ALLOWED_TRANSITIONS: Readonly<Record<StockAdjustmentStatus, readonly StockAdjustmentStatus[]>> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['posted'],
  rejected: [],
  posted: ['reversed'],
  reversed: [],
};

export function canTransitionStockAdjustmentStatus(
  from: StockAdjustmentStatus,
  to: StockAdjustmentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStockAdjustmentTransition(
  from: StockAdjustmentStatus,
  to: StockAdjustmentStatus,
): void {
  if (!canTransitionStockAdjustmentStatus(from, to)) {
    throw new BusinessRuleError(`Stock adjustment cannot move from "${from}" to "${to}".`);
  }
}

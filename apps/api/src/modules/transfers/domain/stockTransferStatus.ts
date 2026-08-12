import type { StockTransferStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/**
 * Stock transfer state machine. No reject/cancel branch is defined (only
 * `transfers.view/create/submit/approve/post/reverse` are permission-gated).
 * `approved -> completed` is an immediate-policy post; `approved ->
 * in_transit -> completed` is an in-transit-policy post followed by receive.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<StockTransferStatus, readonly StockTransferStatus[]>> = {
  draft: ['submitted'],
  submitted: ['approved'],
  approved: ['in_transit', 'completed'],
  in_transit: ['completed'],
  completed: ['reversed'],
  reversed: [],
};

export function canTransitionStockTransferStatus(
  from: StockTransferStatus,
  to: StockTransferStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStockTransferTransition(
  from: StockTransferStatus,
  to: StockTransferStatus,
): void {
  if (!canTransitionStockTransferStatus(from, to)) {
    throw new BusinessRuleError(`Stock transfer cannot move from "${from}" to "${to}".`);
  }
}

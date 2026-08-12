import type { StockRequestStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/**
 * Stock request state machine (SYSTEM_DOCUMENTATION.md section 9.3).
 * `partially_fulfilled`/`fulfilled` are reached only by the Issues module
 * posting against this request, never through a generic status field.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<StockRequestStatus, readonly StockRequestStatus[]>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['partially_fulfilled', 'fulfilled', 'cancelled'],
  rejected: [],
  partially_fulfilled: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

export function canTransitionStockRequestStatus(
  from: StockRequestStatus,
  to: StockRequestStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStockRequestTransition(
  from: StockRequestStatus,
  to: StockRequestStatus,
): void {
  if (!canTransitionStockRequestStatus(from, to)) {
    throw new BusinessRuleError(`Stock request cannot move from "${from}" to "${to}".`);
  }
}

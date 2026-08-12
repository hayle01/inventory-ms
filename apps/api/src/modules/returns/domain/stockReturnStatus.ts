import type { StockReturnStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/** No reversal step -- `returns.view/create/post` are the only permissions defined. */
const ALLOWED_TRANSITIONS: Readonly<Record<StockReturnStatus, readonly StockReturnStatus[]>> = {
  draft: ['posted'],
  posted: [],
};

export function canTransitionStockReturnStatus(
  from: StockReturnStatus,
  to: StockReturnStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertStockReturnTransition(from: StockReturnStatus, to: StockReturnStatus): void {
  if (!canTransitionStockReturnStatus(from, to)) {
    throw new BusinessRuleError(`Stock return cannot move from "${from}" to "${to}".`);
  }
}

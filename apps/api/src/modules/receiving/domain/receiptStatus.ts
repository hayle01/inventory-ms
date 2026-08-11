import type { GoodsReceiptStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/**
 * Goods receipt state machine. `reversed` is reached on the *original*
 * posted receipt only as a metadata stamp (see GoodsReceipt.reversedAt) --
 * reversal receipts themselves are created directly at `posted` and never
 * transition through this machine.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<GoodsReceiptStatus, readonly GoodsReceiptStatus[]>> = {
  draft: ['verified'],
  verified: ['posted'],
  posted: ['reversed'],
  reversed: [],
};

export function canTransitionReceiptStatus(
  from: GoodsReceiptStatus,
  to: GoodsReceiptStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertReceiptTransition(from: GoodsReceiptStatus, to: GoodsReceiptStatus): void {
  if (!canTransitionReceiptStatus(from, to)) {
    throw new BusinessRuleError(`Goods receipt cannot move from "${from}" to "${to}".`);
  }
}

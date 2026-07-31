import type { PurchaseOrderStatus } from '@inventory-ms/contracts';
import { BusinessRuleError } from '../../../shared/http/errors.js';

/**
 * Purchase order state machine (SYSTEM_DOCUMENTATION.md section 9.1).
 * `partially_received`/`fully_received` are reached only by the Receiving
 * module posting against this order, never through a generic status field.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['partially_received', 'fully_received', 'cancelled'],
  rejected: [],
  partially_received: ['fully_received'],
  fully_received: ['closed'],
  closed: [],
  cancelled: [],
};

export function canTransitionPurchaseOrderStatus(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPurchaseOrderTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): void {
  if (!canTransitionPurchaseOrderStatus(from, to)) {
    throw new BusinessRuleError(`Purchase order cannot move from "${from}" to "${to}".`);
  }
}

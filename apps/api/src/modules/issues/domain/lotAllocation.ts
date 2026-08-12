import { Decimal } from 'decimal.js';
import type { Types } from 'mongoose';

/**
 * A candidate stock balance row to allocate from -- one per
 * (location, lot, stockState) key with `availableQuantity` already computed
 * by the caller. `expiresAt`/`receivedAt` come from the joined
 * `InventoryLot` when the row is lot-tracked; non-lot-tracked rows pass
 * `expiresAt: null` and a `receivedAt` proxy (the balance row's own
 * creation time, since there's no per-batch receipt date to key off).
 */
export interface AllocatableBalanceRow {
  balanceId: Types.ObjectId;
  locationId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  availableQuantity: Decimal;
  expiresAt: Date | null;
  receivedAt: Date;
}

export interface LotAllocationLine {
  balanceId: Types.ObjectId;
  locationId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  quantity: Decimal;
}

export interface LotAllocationResult {
  lines: readonly LotAllocationLine[];
  allocatedQuantity: Decimal;
  shortfallQuantity: Decimal;
}

/**
 * Pure allocation function (ADR-007, independently unit-testable, no I/O).
 * FEFO orders eligible rows by expiry date (rows with a known expiry always
 * precede rows without one) then received date; FIFO orders by received
 * date only. Ties break on `balanceId` for a deterministic, reproducible
 * allocation. Greedily consumes rows until `requestedQuantity` is met or
 * rows are exhausted -- any unmet remainder is reported as
 * `shortfallQuantity` rather than thrown, so the caller (an interactive
 * pick step) can show a partial allocation instead of failing outright.
 */
export function allocateLots(
  rows: readonly AllocatableBalanceRow[],
  requestedQuantity: Decimal,
  method: 'fefo' | 'fifo',
): LotAllocationResult {
  const eligible = rows.filter((row) => row.availableQuantity.greaterThan(0));

  const sorted = [...eligible].sort((a, b) => {
    if (method === 'fefo') {
      if (a.expiresAt !== null && b.expiresAt !== null) {
        const diff = a.expiresAt.getTime() - b.expiresAt.getTime();
        if (diff !== 0) return diff;
      } else if (a.expiresAt !== b.expiresAt) {
        return a.expiresAt !== null ? -1 : 1;
      }
    }
    const receivedDiff = a.receivedAt.getTime() - b.receivedAt.getTime();
    if (receivedDiff !== 0) return receivedDiff;
    return a.balanceId.toString().localeCompare(b.balanceId.toString());
  });

  const lines: LotAllocationLine[] = [];
  let remaining = requestedQuantity;

  for (const row of sorted) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const take = Decimal.min(row.availableQuantity, remaining);
    if (take.lessThanOrEqualTo(0)) continue;
    lines.push({
      balanceId: row.balanceId,
      locationId: row.locationId,
      lotId: row.lotId,
      quantity: take,
    });
    remaining = remaining.minus(take);
  }

  return {
    lines,
    allocatedQuantity: requestedQuantity.minus(remaining),
    shortfallQuantity: Decimal.max(0, remaining),
  };
}

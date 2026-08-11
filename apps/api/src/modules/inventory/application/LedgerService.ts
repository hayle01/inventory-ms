import { Decimal } from 'decimal.js';
import { Types, type ClientSession } from 'mongoose';
import type { StockState, StockTransactionType } from '@inventory-ms/contracts';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import { BusinessRuleError } from '../../../shared/http/errors.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';
import { StockTransactionModel } from '../models/StockTransaction.js';
import { StockBalanceModel } from '../models/StockBalance.js';

export interface StockMovementInput {
  productId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  locationId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  stockState: StockState;
  /** Signed decimal string: positive = stock in, negative = stock out. */
  quantity: string;
  unitCost?: string | null;
  /** Bypasses the negative-available-stock guard for this movement only. */
  allowNegative?: boolean;
}

export interface PostMovementsInput {
  organizationId: Types.ObjectId;
  transactionType: StockTransactionType;
  referenceType: string;
  referenceId: Types.ObjectId;
  referenceNumber: string;
  reasonCode?: string | null;
  idempotencyKeyHash?: string | null;
  actorId: Types.ObjectId | null;
  correlationId: string;
  movements: readonly StockMovementInput[];
}

function movementSortKey(movement: StockMovementInput): string {
  return [
    movement.warehouseId.toString(),
    movement.locationId.toString(),
    movement.productId.toString(),
    movement.lotId?.toString() ?? '',
    movement.stockState,
  ].join(':');
}

/**
 * Posts one or more signed stock movements as immutable `stockTransactions`
 * rows and applies them to the `stockBalances` projection, all inside the
 * caller's transaction session. Movements are processed sequentially in a
 * deterministic (sorted) order so concurrent postings that touch overlapping
 * balance keys acquire locks in a consistent order (mandatory inventory
 * invariants: deterministic balance updates, no `Promise.all` in a
 * transaction, negative available stock blocked by default).
 */
export async function postStockMovements(
  input: PostMovementsInput,
  session: ClientSession,
): Promise<void> {
  const ordered = [...input.movements].sort((a, b) =>
    movementSortKey(a).localeCompare(movementSortKey(b)),
  );

  for (const movement of ordered) {
    const quantityDecimal = new Decimal(movement.quantity);
    if (quantityDecimal.isZero()) continue;

    const seq = await nextSequence(`${input.organizationId.toString()}:stockTransaction`, session);
    const transactionNumber = formatSequence('STK', seq);

    await StockTransactionModel.create(
      [
        {
          organizationId: input.organizationId,
          transactionNumber,
          transactionType: input.transactionType,
          productId: movement.productId,
          warehouseId: movement.warehouseId,
          locationId: movement.locationId,
          lotId: movement.lotId,
          stockState: movement.stockState,
          quantity: toDecimal128(quantityDecimal.toFixed()),
          unitCost: movement.unitCost ? toDecimal128(movement.unitCost) : null,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          referenceNumber: input.referenceNumber,
          reasonCode: input.reasonCode ?? null,
          idempotencyKeyHash: input.idempotencyKeyHash ?? null,
          createdBy: input.actorId,
          correlationId: input.correlationId,
        },
      ],
      { session },
    );

    await applyBalanceDelta(input.organizationId, movement, quantityDecimal, session);
  }
}

async function applyBalanceDelta(
  organizationId: Types.ObjectId,
  movement: StockMovementInput,
  quantityDecimal: Decimal,
  session: ClientSession,
): Promise<void> {
  const key = {
    organizationId,
    warehouseId: movement.warehouseId,
    locationId: movement.locationId,
    productId: movement.productId,
    lotId: movement.lotId,
    stockState: movement.stockState,
  };

  if (quantityDecimal.isPositive() || movement.allowNegative) {
    await StockBalanceModel.findOneAndUpdate(
      key,
      {
        $inc: { onHandQuantity: toDecimal128(quantityDecimal.toFixed()), version: 1 },
        $set: { lastTransactionAt: new Date() },
        $setOnInsert: { reservedQuantity: toDecimal128('0') },
      },
      { upsert: true, session },
    );
    return;
  }

  const requiredOnHand = toDecimal128(quantityDecimal.abs().toFixed());
  const updated = await StockBalanceModel.findOneAndUpdate(
    { ...key, onHandQuantity: { $gte: requiredOnHand } },
    {
      $inc: { onHandQuantity: toDecimal128(quantityDecimal.toFixed()), version: 1 },
      $set: { lastTransactionAt: new Date() },
    },
    { session },
  );
  if (!updated) {
    throw new BusinessRuleError('Insufficient available stock to complete this operation.');
  }
}

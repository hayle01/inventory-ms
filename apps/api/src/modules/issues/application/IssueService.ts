import { Decimal } from 'decimal.js';
import { Types, type ClientSession } from 'mongoose';
import type { CreateStockIssueRequest, UpdateStockIssueRequest } from '@inventory-ms/contracts';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import {
  hashIdempotencyPayload,
  withIdempotentPost,
} from '../../../shared/infrastructure/idempotency.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { ProductModel } from '../../catalog/models/Product.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';
import {
  getStockRequestById,
  applyIssuedQuantities,
} from '../../requests/application/StockRequestService.js';
import { StockBalanceModel } from '../../inventory/models/StockBalance.js';
import { InventoryLotModel } from '../../inventory/models/InventoryLot.js';
import {
  postStockMovements,
  type StockMovementInput,
} from '../../inventory/application/LedgerService.js';
import { StockIssueModel, type StockIssueDoc } from '../models/StockIssue.js';
import { assertStockIssueTransition } from '../domain/stockIssueStatus.js';
import { allocateLots, type AllocatableBalanceRow } from '../domain/lotAllocation.js';

export interface OrgActionContext {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  correlationId: string;
}

interface DraftItem {
  lineNumber: number;
  stockRequestLineNumber: number;
  productId: Types.ObjectId;
  productName: string;
  productSku: string;
  locationId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  lotNumber: string | null;
  pickedQuantity: ReturnType<typeof toDecimal128>;
  unitCost: null;
}

async function allocateOutstandingLines(
  organizationId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  stockRequest: Awaited<ReturnType<typeof getStockRequestById>>,
): Promise<DraftItem[]> {
  const outstandingByProduct = stockRequest.items
    .map((item) => ({
      lineNumber: item.lineNumber,
      productId: item.productId,
      outstanding: new Decimal(item.approvedQuantity.toString()).minus(
        item.fulfilledQuantity.toString(),
      ),
    }))
    .filter((entry) => entry.outstanding.greaterThan(0));

  if (outstandingByProduct.length === 0) {
    throw new BusinessRuleError('This stock request has no outstanding approved quantity to issue.');
  }

  const products = await ProductModel.find({
    _id: { $in: outstandingByProduct.map((entry) => entry.productId) },
    organizationId,
  }).lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  const draftItems: DraftItem[] = [];

  for (const entry of outstandingByProduct) {
    const product = productById.get(entry.productId.toString());
    if (!product) continue;

    const balances = await StockBalanceModel.find({
      organizationId,
      warehouseId,
      productId: entry.productId,
      stockState: 'available',
      onHandQuantity: { $gt: toDecimal128('0') },
    }).lean();
    if (balances.length === 0) continue;

    const lotIds = balances
      .map((balance) => balance.lotId)
      .filter((lotId): lotId is Types.ObjectId => lotId !== null);
    const lots =
      lotIds.length > 0
        ? await InventoryLotModel.find({
            organizationId,
            _id: { $in: lotIds },
            status: 'active',
          }).lean()
        : [];
    const lotById = new Map(lots.map((lot) => [lot._id.toString(), lot]));

    const rows: AllocatableBalanceRow[] = balances
      .filter((balance) => !balance.lotId || lotById.has(balance.lotId.toString()))
      .map((balance) => {
        const lot = balance.lotId ? lotById.get(balance.lotId.toString()) : undefined;
        return {
          balanceId: balance._id,
          locationId: balance.locationId,
          lotId: balance.lotId ?? null,
          availableQuantity: new Decimal(balance.onHandQuantity.toString()),
          expiresAt: lot?.expiresAt ?? null,
          receivedAt: lot?.receivedAt ?? balance.createdAt,
        };
      });

    const method = product.trackExpiry ? 'fefo' : 'fifo';
    const allocation = allocateLots(rows, entry.outstanding, method);

    for (const line of allocation.lines) {
      const lot = line.lotId ? lotById.get(line.lotId.toString()) : undefined;
      draftItems.push({
        lineNumber: draftItems.length + 1,
        stockRequestLineNumber: entry.lineNumber,
        productId: entry.productId,
        productName: product.name,
        productSku: product.sku,
        locationId: line.locationId,
        lotId: line.lotId,
        lotNumber: lot?.lotNumber ?? null,
        pickedQuantity: toDecimal128(line.quantity.toFixed()),
        unitCost: null,
      });
    }
  }

  if (draftItems.length === 0) {
    throw new BusinessRuleError('No stock is currently available to pick for this request.');
  }

  return draftItems;
}

export async function listStockIssues(organizationId: Types.ObjectId): Promise<StockIssueDoc[]> {
  return StockIssueModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getStockIssueById(
  organizationId: Types.ObjectId,
  stockIssueId: Types.ObjectId,
): Promise<StockIssueDoc> {
  const stockIssue = await StockIssueModel.findOne({ _id: stockIssueId, organizationId }).lean();
  if (!stockIssue) throw new NotFoundError('Stock issue not found.');
  return stockIssue;
}

export async function createStockIssue(
  context: OrgActionContext,
  input: CreateStockIssueRequest,
): Promise<StockIssueDoc> {
  const stockRequestObjectId = new Types.ObjectId(input.stockRequestId);
  const stockRequest = await getStockRequestById(context.organizationId, stockRequestObjectId);
  if (!['approved', 'partially_fulfilled'].includes(stockRequest.status)) {
    throw new ValidationError('The stock request must be approved before issuing against it.');
  }

  const items = await allocateOutstandingLines(
    context.organizationId,
    stockRequest.warehouseId,
    stockRequest,
  );

  const stockIssue = await withTransaction(
    async (session) => {
      const seq = await nextSequence(`${context.organizationId.toString()}:stockIssue`, session);
      const [created] = await StockIssueModel.create(
        [
          {
            organizationId: context.organizationId,
            issueNumber: formatSequence('ISS', seq),
            stockRequestId: stockRequestObjectId,
            warehouseId: stockRequest.warehouseId,
            status: 'draft',
            items,
            notes: input.notes ?? null,
            createdBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Stock issue creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'issues.stockIssue.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'issues.create',
    resourceType: 'stockIssue',
    resourceId: stockIssue._id,
    resourceNumber: stockIssue.issueNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockIssue.toObject();
}

export async function updateStockIssue(
  context: OrgActionContext,
  stockIssueId: Types.ObjectId,
  input: UpdateStockIssueRequest,
): Promise<StockIssueDoc> {
  const stockIssue = await StockIssueModel.findOne({
    _id: stockIssueId,
    organizationId: context.organizationId,
  });
  if (!stockIssue) throw new NotFoundError('Stock issue not found.');
  if (stockIssue.status !== 'draft') {
    throw new ValidationError('Only draft stock issues can be edited.');
  }

  const changedFields: Record<string, unknown> = {};

  if (input.items !== undefined) {
    changedFields['items'] = true;
    const itemByLine = new Map(stockIssue.items.map((item) => [item.lineNumber, item]));
    for (const override of input.items) {
      const item = itemByLine.get(override.lineNumber);
      if (!item) {
        throw new ValidationError(`Line ${String(override.lineNumber)} does not exist on this issue.`);
      }
      item.locationId = new Types.ObjectId(override.locationId);
      item.lotId = override.lotId ? new Types.ObjectId(override.lotId) : null;
      item.pickedQuantity = toDecimal128(override.pickedQuantity);
    }
  }
  if (input.notes !== undefined) {
    changedFields['notes'] = true;
    stockIssue.notes = input.notes;
  }

  stockIssue.version += 1;
  await stockIssue.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'issues.update',
    resourceType: 'stockIssue',
    resourceId: stockIssue._id,
    resourceNumber: stockIssue.issueNumber,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return stockIssue.toObject();
}

export async function pickStockIssue(
  context: OrgActionContext,
  stockIssueId: Types.ObjectId,
): Promise<StockIssueDoc> {
  const stockIssue = await StockIssueModel.findOne({
    _id: stockIssueId,
    organizationId: context.organizationId,
  });
  if (!stockIssue) throw new NotFoundError('Stock issue not found.');
  assertStockIssueTransition(stockIssue.status, 'picked');

  const hasPickedLine = stockIssue.items.some((item) =>
    new Decimal(item.pickedQuantity.toString()).greaterThan(0),
  );
  if (!hasPickedLine) {
    throw new ValidationError('At least one line must have a picked quantity above zero.');
  }

  stockIssue.status = 'picked';
  stockIssue.pickedBy = context.actorId;
  stockIssue.pickedAt = new Date();
  stockIssue.version += 1;
  await stockIssue.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'issues.pick',
    resourceType: 'stockIssue',
    resourceId: stockIssue._id,
    resourceNumber: stockIssue.issueNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockIssue.toObject();
}

export async function cancelStockIssue(
  context: OrgActionContext,
  stockIssueId: Types.ObjectId,
  reason: string,
): Promise<StockIssueDoc> {
  const stockIssue = await StockIssueModel.findOne({
    _id: stockIssueId,
    organizationId: context.organizationId,
  });
  if (!stockIssue) throw new NotFoundError('Stock issue not found.');
  assertStockIssueTransition(stockIssue.status, 'cancelled');

  stockIssue.status = 'cancelled';
  stockIssue.cancelledBy = context.actorId;
  stockIssue.cancelledAt = new Date();
  stockIssue.cancellationReason = reason;
  stockIssue.version += 1;
  await stockIssue.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'issues.update',
    resourceType: 'stockIssue',
    resourceId: stockIssue._id,
    resourceNumber: stockIssue.issueNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return stockIssue.toObject();
}

export async function postStockIssue(
  context: OrgActionContext,
  stockIssueId: Types.ObjectId,
  idempotencyKey: string | undefined,
): Promise<StockIssueDoc> {
  const stockIssue = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'issues.post',
          key: idempotencyKey,
          requestPayload: { stockIssueId: stockIssueId.toString() },
        },
        session,
        async () => {
          const doc = await StockIssueModel.findOne({
            _id: stockIssueId,
            organizationId: context.organizationId,
          }).session(session);
          if (!doc) throw new NotFoundError('Stock issue not found.');
          assertStockIssueTransition(doc.status, 'posted');

          const movements: StockMovementInput[] = [];
          const issuedByProduct = new Map<string, Decimal>();

          for (const item of doc.items) {
            const pickedDecimal = new Decimal(item.pickedQuantity.toString());
            if (pickedDecimal.isZero()) continue;

            movements.push({
              productId: item.productId,
              warehouseId: doc.warehouseId,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: pickedDecimal.negated().toFixed(),
            });

            const key = item.productId.toString();
            issuedByProduct.set(key, (issuedByProduct.get(key) ?? new Decimal(0)).plus(pickedDecimal));
          }

          if (movements.length === 0) {
            throw new BusinessRuleError('This issue has no picked quantity to post.');
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'issue',
              referenceType: 'stockIssue',
              referenceId: doc._id,
              referenceNumber: doc.issueNumber,
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          await applyIssuedQuantities(session, context.organizationId, doc.stockRequestId, issuedByProduct);

          doc.status = 'posted';
          doc.postedBy = context.actorId;
          doc.postedAt = new Date();
          doc.version += 1;
          await doc.save({ session });

          return { resultRef: doc._id, result: doc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockIssueModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock issue not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'issues.stockIssue.post' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'issues.post',
    resourceType: 'stockIssue',
    resourceId: stockIssue._id,
    resourceNumber: stockIssue.issueNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockIssue;
}

export async function reverseStockIssue(
  context: OrgActionContext,
  stockIssueId: Types.ObjectId,
  reason: string,
  idempotencyKey: string | undefined,
): Promise<StockIssueDoc> {
  const reversal = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'issues.reverse',
          key: idempotencyKey,
          requestPayload: { stockIssueId: stockIssueId.toString(), reason },
        },
        session,
        async () => {
          const original = await StockIssueModel.findOne({
            _id: stockIssueId,
            organizationId: context.organizationId,
          }).session(session);
          if (!original) throw new NotFoundError('Stock issue not found.');
          if (original.status !== 'posted') {
            throw new BusinessRuleError('Only posted stock issues can be reversed.');
          }

          const seq = await nextSequence(`${context.organizationId.toString()}:stockIssue`, session);
          const [reversalDoc] = await StockIssueModel.create(
            [
              {
                organizationId: context.organizationId,
                issueNumber: formatSequence('ISS', seq),
                stockRequestId: original.stockRequestId,
                warehouseId: original.warehouseId,
                status: 'posted',
                items: original.items,
                notes: reason,
                reversalOfId: original._id,
                createdBy: context.actorId,
                postedBy: context.actorId,
                postedAt: new Date(),
              },
            ],
            { session },
          );
          if (!reversalDoc) throw new Error('Reversal issue creation failed unexpectedly.');

          const movements: StockMovementInput[] = [];
          const issuedByProduct = new Map<string, Decimal>();

          for (const item of original.items) {
            const pickedDecimal = new Decimal(item.pickedQuantity.toString());
            if (pickedDecimal.isZero()) continue;

            movements.push({
              productId: item.productId,
              warehouseId: original.warehouseId,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: pickedDecimal.toFixed(),
            });

            const key = item.productId.toString();
            issuedByProduct.set(
              key,
              (issuedByProduct.get(key) ?? new Decimal(0)).minus(pickedDecimal),
            );
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'reversal',
              referenceType: 'stockIssue',
              referenceId: reversalDoc._id,
              referenceNumber: reversalDoc.issueNumber,
              reasonCode: 'reversal',
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          await applyIssuedQuantities(session, context.organizationId, original.stockRequestId, issuedByProduct);

          original.reversedBy = context.actorId;
          original.reversedAt = new Date();
          await original.save({ session });

          return { resultRef: reversalDoc._id, result: reversalDoc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockIssueModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock issue not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'issues.stockIssue.reverse' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'issues.reverse',
    resourceType: 'stockIssue',
    resourceId: reversal._id,
    resourceNumber: reversal.issueNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return reversal;
}

/**
 * Increments the returned quantity on specific issue lines and validates
 * that no line's cumulative returns exceed what was actually picked.
 * Exposed as an application function -- not a shared model -- so the
 * Returns module never imports `StockIssueModel` directly (no cross-module
 * model imports).
 */
export async function applyReturnedQuantities(
  session: ClientSession,
  organizationId: Types.ObjectId,
  stockIssueId: Types.ObjectId,
  returnedByLineNumber: ReadonlyMap<number, Decimal>,
): Promise<void> {
  const stockIssue = await StockIssueModel.findOne({ _id: stockIssueId, organizationId }).session(
    session,
  );
  if (!stockIssue) throw new NotFoundError('Stock issue not found.');

  for (const item of stockIssue.items) {
    const returned = returnedByLineNumber.get(item.lineNumber);
    if (!returned || returned.lessThanOrEqualTo(0)) continue;

    const alreadyReturned = new Decimal(item.returnedQuantity.toString());
    const picked = new Decimal(item.pickedQuantity.toString());
    const nextReturned = alreadyReturned.plus(returned);
    if (nextReturned.greaterThan(picked)) {
      throw new BusinessRuleError(
        `Line ${String(item.lineNumber)} cannot return more than was picked.`,
      );
    }
    item.returnedQuantity = toDecimal128(nextReturned.toFixed());
  }

  stockIssue.version += 1;
  await stockIssue.save({ session });
}

import { Decimal } from 'decimal.js';
import { Types } from 'mongoose';
import type {
  CreateStockCountRequest,
  StockCountLineSelector,
  UpdateStockCountRequest,
} from '@inventory-ms/contracts';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import {
  hashIdempotencyPayload,
  withIdempotentPost,
} from '../../../shared/infrastructure/idempotency.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { countsPolicy } from '../../../config.js';
import { WarehouseModel } from '../../organization/models/Warehouse.js';
import { StorageLocationModel } from '../../organization/models/StorageLocation.js';
import { ProductModel } from '../../catalog/models/Product.js';
import { InventoryLotModel } from '../../inventory/models/InventoryLot.js';
import { StockBalanceModel } from '../../inventory/models/StockBalance.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';
import {
  postStockMovements,
  type StockMovementInput,
} from '../../inventory/application/LedgerService.js';
import { StockCountModel, type StockCountDoc } from '../models/StockCount.js';
import { assertStockCountTransition } from '../domain/stockCountStatus.js';

export interface OrgActionContext {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  correlationId: string;
}

interface ResolvedItem {
  lineNumber: number;
  productId: Types.ObjectId;
  productName: string;
  productSku: string;
  locationId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  lotNumber: string | null;
  systemQuantity: ReturnType<typeof toDecimal128>;
  countedQuantity: null;
  varianceQuantity: null;
  note: null;
}

async function assertWarehouse(
  organizationId: Types.ObjectId,
  warehouseId: string,
): Promise<Types.ObjectId> {
  const warehouseObjectId = new Types.ObjectId(warehouseId);
  const warehouse = await WarehouseModel.findOne({
    _id: warehouseObjectId,
    organizationId,
    status: { $ne: 'archived' },
  }).lean();
  if (!warehouse) throw new ValidationError('Warehouse does not exist or is archived.');
  return warehouseObjectId;
}

async function resolveSnapshotItems(
  organizationId: Types.ObjectId,
  warehouseObjectId: Types.ObjectId,
  selectors: readonly StockCountLineSelector[],
): Promise<ResolvedItem[]> {
  const productIds = selectors.map((selector) => new Types.ObjectId(selector.productId));
  const locationIds = selectors.map((selector) => new Types.ObjectId(selector.locationId));
  const lotIds = selectors
    .filter((selector): selector is StockCountLineSelector & { lotId: string } =>
      Boolean(selector.lotId),
    )
    .map((selector) => new Types.ObjectId(selector.lotId));

  const [products, locations, lots] = await Promise.all([
    ProductModel.find({
      _id: { $in: productIds },
      organizationId,
      status: { $ne: 'archived' },
    }).lean(),
    StorageLocationModel.find({
      _id: { $in: locationIds },
      organizationId,
      warehouseId: warehouseObjectId,
      status: { $ne: 'archived' },
    }).lean(),
    lotIds.length > 0
      ? InventoryLotModel.find({ _id: { $in: lotIds }, organizationId }).lean()
      : Promise.resolve([]),
  ]);
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  const locationById = new Map(locations.map((location) => [location._id.toString(), location]));
  const lotById = new Map(lots.map((lot) => [lot._id.toString(), lot]));

  const items: ResolvedItem[] = [];
  for (const [index, selector] of selectors.entries()) {
    const product = productById.get(selector.productId);
    if (!product) throw new ValidationError(`Product ${selector.productId} does not exist or is archived.`);
    const location = locationById.get(selector.locationId);
    if (!location) {
      throw new ValidationError(
        `Location ${selector.locationId} does not exist in this warehouse or is archived.`,
      );
    }
    let lot = null as (typeof lots)[number] | null;
    if (selector.lotId) {
      lot = lotById.get(selector.lotId) ?? null;
      if (!lot) throw new ValidationError(`Lot ${selector.lotId} does not exist.`);
    }

    const balance = await StockBalanceModel.findOne({
      organizationId,
      warehouseId: warehouseObjectId,
      locationId: location._id,
      productId: product._id,
      lotId: lot?._id ?? null,
      stockState: 'available',
    }).lean();

    items.push({
      lineNumber: index + 1,
      productId: product._id,
      productName: product.name,
      productSku: product.sku,
      locationId: location._id,
      lotId: lot?._id ?? null,
      lotNumber: lot?.lotNumber ?? null,
      systemQuantity: toDecimal128(
        balance ? balance.onHandQuantity.toString() : '0',
      ),
      countedQuantity: null,
      varianceQuantity: null,
      note: null,
    });
  }
  return items;
}

export async function listStockCounts(organizationId: Types.ObjectId): Promise<StockCountDoc[]> {
  return StockCountModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getStockCountById(
  organizationId: Types.ObjectId,
  stockCountId: Types.ObjectId,
): Promise<StockCountDoc> {
  const stockCount = await StockCountModel.findOne({ _id: stockCountId, organizationId }).lean();
  if (!stockCount) throw new NotFoundError('Stock count not found.');
  return stockCount;
}

export async function createStockCount(
  context: OrgActionContext,
  input: CreateStockCountRequest,
): Promise<StockCountDoc> {
  const warehouseObjectId = await assertWarehouse(context.organizationId, input.warehouseId);
  const items = await resolveSnapshotItems(context.organizationId, warehouseObjectId, input.items);

  const stockCount = await withTransaction(
    async (session) => {
      const seq = await nextSequence(`${context.organizationId.toString()}:stockCount`, session);
      const [created] = await StockCountModel.create(
        [
          {
            organizationId: context.organizationId,
            countNumber: formatSequence('CNT', seq),
            warehouseId: warehouseObjectId,
            status: 'draft',
            scope: input.scope,
            blindCount: input.blindCount,
            snapshotAt: new Date(),
            items,
            notes: input.notes ?? null,
            createdBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Stock count creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'counts.stockCount.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_counts.create',
    resourceType: 'stockCount',
    resourceId: stockCount._id,
    resourceNumber: stockCount.countNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockCount.toObject();
}

export async function updateStockCount(
  context: OrgActionContext,
  stockCountId: Types.ObjectId,
  input: UpdateStockCountRequest,
): Promise<StockCountDoc> {
  const stockCount = await StockCountModel.findOne({
    _id: stockCountId,
    organizationId: context.organizationId,
  });
  if (!stockCount) throw new NotFoundError('Stock count not found.');
  if (stockCount.status !== 'draft') {
    throw new ValidationError('Only draft stock counts can be edited.');
  }

  const changedFields: Record<string, unknown> = {};

  if (input.items !== undefined) {
    changedFields['items'] = true;
    const itemByLine = new Map(stockCount.items.map((item) => [item.lineNumber, item]));
    for (const entry of input.items) {
      const item = itemByLine.get(entry.lineNumber);
      if (!item) {
        throw new ValidationError(`Line ${String(entry.lineNumber)} does not exist on this count.`);
      }
      item.countedQuantity = toDecimal128(entry.countedQuantity);
      if (entry.note !== undefined) item.note = entry.note;
    }
  }
  if (input.notes !== undefined) {
    changedFields['notes'] = true;
    stockCount.notes = input.notes;
  }

  stockCount.version += 1;
  await stockCount.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_counts.update',
    resourceType: 'stockCount',
    resourceId: stockCount._id,
    resourceNumber: stockCount.countNumber,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return stockCount.toObject();
}

export async function submitStockCount(
  context: OrgActionContext,
  stockCountId: Types.ObjectId,
): Promise<StockCountDoc> {
  const stockCount = await StockCountModel.findOne({
    _id: stockCountId,
    organizationId: context.organizationId,
  });
  if (!stockCount) throw new NotFoundError('Stock count not found.');

  assertStockCountTransition(stockCount.status, 'submitted');

  for (const item of stockCount.items) {
    if (item.countedQuantity === null || item.countedQuantity === undefined) {
      throw new ValidationError(
        `Line ${String(item.lineNumber)} has not been counted yet. Enter a counted quantity for every line before submitting.`,
      );
    }
    const variance = new Decimal(item.countedQuantity.toString()).minus(
      item.systemQuantity.toString(),
    );
    item.varianceQuantity = toDecimal128(variance.toFixed());
  }

  stockCount.status = 'submitted';
  stockCount.submittedBy = context.actorId;
  stockCount.submittedAt = new Date();
  stockCount.version += 1;
  await stockCount.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_counts.submit',
    resourceType: 'stockCount',
    resourceId: stockCount._id,
    resourceNumber: stockCount.countNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockCount.toObject();
}

export async function approveStockCount(
  context: OrgActionContext,
  stockCountId: Types.ObjectId,
): Promise<StockCountDoc> {
  const stockCount = await StockCountModel.findOne({
    _id: stockCountId,
    organizationId: context.organizationId,
  });
  if (!stockCount) throw new NotFoundError('Stock count not found.');
  if (countsPolicy.preventSelfApproval && stockCount.createdBy?.equals(context.actorId)) {
    throw new ForbiddenError('You cannot approve a stock count you created.');
  }

  assertStockCountTransition(stockCount.status, 'approved');
  stockCount.status = 'approved';
  stockCount.approvedBy = context.actorId;
  stockCount.approvedAt = new Date();
  stockCount.version += 1;
  await stockCount.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_counts.approve',
    resourceType: 'stockCount',
    resourceId: stockCount._id,
    resourceNumber: stockCount.countNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockCount.toObject();
}

export async function rejectStockCount(
  context: OrgActionContext,
  stockCountId: Types.ObjectId,
  reason: string,
): Promise<StockCountDoc> {
  const stockCount = await StockCountModel.findOne({
    _id: stockCountId,
    organizationId: context.organizationId,
  });
  if (!stockCount) throw new NotFoundError('Stock count not found.');

  assertStockCountTransition(stockCount.status, 'rejected');
  stockCount.status = 'rejected';
  stockCount.rejectedBy = context.actorId;
  stockCount.rejectedAt = new Date();
  stockCount.rejectionReason = reason;
  stockCount.version += 1;
  await stockCount.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_counts.reject',
    resourceType: 'stockCount',
    resourceId: stockCount._id,
    resourceNumber: stockCount.countNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return stockCount.toObject();
}

export async function postStockCount(
  context: OrgActionContext,
  stockCountId: Types.ObjectId,
  idempotencyKey: string | undefined,
): Promise<StockCountDoc> {
  const stockCount = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'stock_counts.post',
          key: idempotencyKey,
          requestPayload: { stockCountId: stockCountId.toString() },
        },
        session,
        async () => {
          const doc = await StockCountModel.findOne({
            _id: stockCountId,
            organizationId: context.organizationId,
          }).session(session);
          if (!doc) throw new NotFoundError('Stock count not found.');
          assertStockCountTransition(doc.status, 'posted');

          const movements: StockMovementInput[] = [];
          for (const item of doc.items) {
            if (item.varianceQuantity === null || item.varianceQuantity === undefined) continue;
            const varianceDecimal = new Decimal(item.varianceQuantity.toString());
            if (varianceDecimal.isZero()) continue;

            movements.push({
              productId: item.productId,
              warehouseId: doc.warehouseId,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: varianceDecimal.toFixed(),
            });
          }

          if (movements.length > 0) {
            await postStockMovements(
              {
                organizationId: context.organizationId,
                transactionType: 'adjustment',
                referenceType: 'stockCount',
                referenceId: doc._id,
                referenceNumber: doc.countNumber,
                reasonCode: 'count_correction',
                actorId: context.actorId,
                correlationId: context.correlationId,
                idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
                movements,
              },
              session,
            );
          }

          doc.status = 'posted';
          doc.postedBy = context.actorId;
          doc.postedAt = new Date();
          doc.version += 1;
          await doc.save({ session });

          return { resultRef: doc._id, result: doc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockCountModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock count not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'counts.stockCount.post' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_counts.post',
    resourceType: 'stockCount',
    resourceId: stockCount._id,
    resourceNumber: stockCount.countNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockCount;
}

export async function reverseStockCount(
  context: OrgActionContext,
  stockCountId: Types.ObjectId,
  reason: string,
  idempotencyKey: string | undefined,
): Promise<StockCountDoc> {
  const reversal = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'stock_counts.reverse',
          key: idempotencyKey,
          requestPayload: { stockCountId: stockCountId.toString(), reason },
        },
        session,
        async () => {
          const original = await StockCountModel.findOne({
            _id: stockCountId,
            organizationId: context.organizationId,
          }).session(session);
          if (!original) throw new NotFoundError('Stock count not found.');
          if (original.status !== 'posted') {
            throw new BusinessRuleError('Only posted stock counts can be reversed.');
          }

          const seq = await nextSequence(`${context.organizationId.toString()}:stockCount`, session);
          const negatedItems = original.items.map((item) => {
            const variance = item.varianceQuantity
              ? new Decimal(item.varianceQuantity.toString()).negated()
              : new Decimal(0);
            return {
              lineNumber: item.lineNumber,
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSku,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              lotNumber: item.lotNumber ?? null,
              systemQuantity: item.systemQuantity,
              countedQuantity: item.countedQuantity,
              varianceQuantity: toDecimal128(variance.toFixed()),
              note: original.notes,
            };
          });

          const [reversalDoc] = await StockCountModel.create(
            [
              {
                organizationId: context.organizationId,
                countNumber: formatSequence('CNT', seq),
                warehouseId: original.warehouseId,
                status: 'posted',
                scope: original.scope,
                blindCount: original.blindCount,
                snapshotAt: new Date(),
                items: negatedItems,
                notes: reason,
                reversalOfId: original._id,
                createdBy: context.actorId,
                postedBy: context.actorId,
                postedAt: new Date(),
              },
            ],
            { session },
          );
          if (!reversalDoc) throw new Error('Reversal count creation failed unexpectedly.');

          const movements: StockMovementInput[] = [];
          for (const item of reversalDoc.items) {
            const varianceDecimal = new Decimal(item.varianceQuantity?.toString() ?? '0');
            if (varianceDecimal.isZero()) continue;
            movements.push({
              productId: item.productId,
              warehouseId: reversalDoc.warehouseId,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: varianceDecimal.toFixed(),
            });
          }

          if (movements.length > 0) {
            await postStockMovements(
              {
                organizationId: context.organizationId,
                transactionType: 'reversal',
                referenceType: 'stockCount',
                referenceId: reversalDoc._id,
                referenceNumber: reversalDoc.countNumber,
                reasonCode: 'reversal',
                actorId: context.actorId,
                correlationId: context.correlationId,
                idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
                movements,
              },
              session,
            );
          }

          original.reversedBy = context.actorId;
          original.reversedAt = new Date();
          await original.save({ session });

          return { resultRef: reversalDoc._id, result: reversalDoc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockCountModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock count not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'counts.stockCount.reverse' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_counts.reverse',
    resourceType: 'stockCount',
    resourceId: reversal._id,
    resourceNumber: reversal.countNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return reversal;
}

import { Decimal } from 'decimal.js';
import { Types } from 'mongoose';
import type {
  CreateStockAdjustmentRequest,
  StockAdjustmentItemInput,
  UpdateStockAdjustmentRequest,
} from '@inventory-ms/contracts';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import {
  hashIdempotencyPayload,
  withIdempotentPost,
} from '../../../shared/infrastructure/idempotency.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { adjustmentsPolicy } from '../../../config.js';
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
import { StockAdjustmentModel, type StockAdjustmentDoc } from '../models/StockAdjustment.js';
import { assertStockAdjustmentTransition } from '../domain/stockAdjustmentStatus.js';

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
  stockState: StockAdjustmentItemInput['stockState'];
  quantityDelta: ReturnType<typeof toDecimal128>;
  priorQuantity: null;
  resultingQuantity: null;
  note: string | null;
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

async function resolveItems(
  organizationId: Types.ObjectId,
  warehouseObjectId: Types.ObjectId,
  items: readonly StockAdjustmentItemInput[],
): Promise<ResolvedItem[]> {
  const productIds = items.map((item) => new Types.ObjectId(item.productId));
  const locationIds = items.map((item) => new Types.ObjectId(item.locationId));
  const lotIds = items
    .filter((item): item is StockAdjustmentItemInput & { lotId: string } => Boolean(item.lotId))
    .map((item) => new Types.ObjectId(item.lotId));

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

  return items.map((item, index) => {
    const product = productById.get(item.productId);
    if (!product) throw new ValidationError(`Product ${item.productId} does not exist or is archived.`);
    const location = locationById.get(item.locationId);
    if (!location) {
      throw new ValidationError(
        `Location ${item.locationId} does not exist in this warehouse or is archived.`,
      );
    }
    let lot = null as (typeof lots)[number] | null;
    if (item.lotId) {
      lot = lotById.get(item.lotId) ?? null;
      if (!lot) throw new ValidationError(`Lot ${item.lotId} does not exist.`);
    }

    return {
      lineNumber: index + 1,
      productId: product._id,
      productName: product.name,
      productSku: product.sku,
      locationId: location._id,
      lotId: lot?._id ?? null,
      lotNumber: lot?.lotNumber ?? null,
      stockState: item.stockState,
      quantityDelta: toDecimal128(item.quantityDelta),
      priorQuantity: null,
      resultingQuantity: null,
      note: item.note ?? null,
    };
  });
}

function computeRequiresElevatedApproval(items: readonly ResolvedItem[]): boolean {
  const totalMagnitude = items.reduce(
    (sum, item) => sum.plus(new Decimal(item.quantityDelta.toString()).abs()),
    new Decimal(0),
  );
  return totalMagnitude.greaterThanOrEqualTo(adjustmentsPolicy.materialQuantityThreshold);
}

export async function listStockAdjustments(
  organizationId: Types.ObjectId,
): Promise<StockAdjustmentDoc[]> {
  return StockAdjustmentModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getStockAdjustmentById(
  organizationId: Types.ObjectId,
  stockAdjustmentId: Types.ObjectId,
): Promise<StockAdjustmentDoc> {
  const stockAdjustment = await StockAdjustmentModel.findOne({
    _id: stockAdjustmentId,
    organizationId,
  }).lean();
  if (!stockAdjustment) throw new NotFoundError('Stock adjustment not found.');
  return stockAdjustment;
}

export async function createStockAdjustment(
  context: OrgActionContext,
  input: CreateStockAdjustmentRequest,
): Promise<StockAdjustmentDoc> {
  const warehouseObjectId = await assertWarehouse(context.organizationId, input.warehouseId);
  const items = await resolveItems(context.organizationId, warehouseObjectId, input.items);
  const requiresElevatedApproval = computeRequiresElevatedApproval(items);

  const stockAdjustment = await withTransaction(
    async (session) => {
      const seq = await nextSequence(
        `${context.organizationId.toString()}:stockAdjustment`,
        session,
      );
      const [created] = await StockAdjustmentModel.create(
        [
          {
            organizationId: context.organizationId,
            adjustmentNumber: formatSequence('ADJ', seq),
            warehouseId: warehouseObjectId,
            status: 'draft',
            reasonCode: input.reasonCode,
            items,
            requiresElevatedApproval,
            evidenceNote: input.evidenceNote ?? null,
            notes: input.notes ?? null,
            createdBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Stock adjustment creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'adjustments.stockAdjustment.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'adjustments.create',
    resourceType: 'stockAdjustment',
    resourceId: stockAdjustment._id,
    resourceNumber: stockAdjustment.adjustmentNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockAdjustment.toObject();
}

export async function updateStockAdjustment(
  context: OrgActionContext,
  stockAdjustmentId: Types.ObjectId,
  input: UpdateStockAdjustmentRequest,
): Promise<StockAdjustmentDoc> {
  const stockAdjustment = await StockAdjustmentModel.findOne({
    _id: stockAdjustmentId,
    organizationId: context.organizationId,
  });
  if (!stockAdjustment) throw new NotFoundError('Stock adjustment not found.');
  if (stockAdjustment.status !== 'draft') {
    throw new ValidationError('Only draft stock adjustments can be edited.');
  }

  const changedFields: Record<string, unknown> = {};

  if (input.items !== undefined) {
    changedFields['items'] = true;
    const items = await resolveItems(context.organizationId, stockAdjustment.warehouseId, input.items);
    stockAdjustment.items = items as unknown as typeof stockAdjustment.items;
    stockAdjustment.requiresElevatedApproval = computeRequiresElevatedApproval(items);
  }
  if (input.reasonCode !== undefined) {
    changedFields['reasonCode'] = true;
    stockAdjustment.reasonCode = input.reasonCode;
  }
  if (input.evidenceNote !== undefined) {
    changedFields['evidenceNote'] = true;
    stockAdjustment.evidenceNote = input.evidenceNote;
  }
  if (input.notes !== undefined) {
    changedFields['notes'] = true;
    stockAdjustment.notes = input.notes;
  }

  stockAdjustment.version += 1;
  await stockAdjustment.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'adjustments.update',
    resourceType: 'stockAdjustment',
    resourceId: stockAdjustment._id,
    resourceNumber: stockAdjustment.adjustmentNumber,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return stockAdjustment.toObject();
}

export async function submitStockAdjustment(
  context: OrgActionContext,
  stockAdjustmentId: Types.ObjectId,
): Promise<StockAdjustmentDoc> {
  const stockAdjustment = await StockAdjustmentModel.findOne({
    _id: stockAdjustmentId,
    organizationId: context.organizationId,
  });
  if (!stockAdjustment) throw new NotFoundError('Stock adjustment not found.');

  assertStockAdjustmentTransition(stockAdjustment.status, 'submitted');
  stockAdjustment.status = 'submitted';
  stockAdjustment.submittedBy = context.actorId;
  stockAdjustment.submittedAt = new Date();
  stockAdjustment.version += 1;
  await stockAdjustment.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'adjustments.submit',
    resourceType: 'stockAdjustment',
    resourceId: stockAdjustment._id,
    resourceNumber: stockAdjustment.adjustmentNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockAdjustment.toObject();
}

export async function approveStockAdjustment(
  context: OrgActionContext,
  stockAdjustmentId: Types.ObjectId,
): Promise<StockAdjustmentDoc> {
  const stockAdjustment = await StockAdjustmentModel.findOne({
    _id: stockAdjustmentId,
    organizationId: context.organizationId,
  });
  if (!stockAdjustment) throw new NotFoundError('Stock adjustment not found.');
  if (
    adjustmentsPolicy.preventSelfApproval &&
    stockAdjustment.createdBy?.equals(context.actorId)
  ) {
    throw new ForbiddenError('You cannot approve a stock adjustment you created.');
  }

  assertStockAdjustmentTransition(stockAdjustment.status, 'approved');
  stockAdjustment.status = 'approved';
  stockAdjustment.approvedBy = context.actorId;
  stockAdjustment.approvedAt = new Date();
  stockAdjustment.version += 1;
  await stockAdjustment.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'adjustments.approve',
    resourceType: 'stockAdjustment',
    resourceId: stockAdjustment._id,
    resourceNumber: stockAdjustment.adjustmentNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockAdjustment.toObject();
}

export async function rejectStockAdjustment(
  context: OrgActionContext,
  stockAdjustmentId: Types.ObjectId,
  reason: string,
): Promise<StockAdjustmentDoc> {
  const stockAdjustment = await StockAdjustmentModel.findOne({
    _id: stockAdjustmentId,
    organizationId: context.organizationId,
  });
  if (!stockAdjustment) throw new NotFoundError('Stock adjustment not found.');

  assertStockAdjustmentTransition(stockAdjustment.status, 'rejected');
  stockAdjustment.status = 'rejected';
  stockAdjustment.rejectedBy = context.actorId;
  stockAdjustment.rejectedAt = new Date();
  stockAdjustment.rejectionReason = reason;
  stockAdjustment.version += 1;
  await stockAdjustment.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'adjustments.reject',
    resourceType: 'stockAdjustment',
    resourceId: stockAdjustment._id,
    resourceNumber: stockAdjustment.adjustmentNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return stockAdjustment.toObject();
}

export async function postStockAdjustment(
  context: OrgActionContext,
  stockAdjustmentId: Types.ObjectId,
  idempotencyKey: string | undefined,
): Promise<StockAdjustmentDoc> {
  const stockAdjustment = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'adjustments.post',
          key: idempotencyKey,
          requestPayload: { stockAdjustmentId: stockAdjustmentId.toString() },
        },
        session,
        async () => {
          const doc = await StockAdjustmentModel.findOne({
            _id: stockAdjustmentId,
            organizationId: context.organizationId,
          }).session(session);
          if (!doc) throw new NotFoundError('Stock adjustment not found.');
          assertStockAdjustmentTransition(doc.status, 'posted');

          const movements: StockMovementInput[] = [];

          for (const item of doc.items) {
            const deltaDecimal = new Decimal(item.quantityDelta.toString());
            const key = {
              organizationId: context.organizationId,
              warehouseId: doc.warehouseId,
              locationId: item.locationId,
              productId: item.productId,
              lotId: item.lotId ?? null,
              stockState: item.stockState,
            };
            const existingBalance = await StockBalanceModel.findOne(key).session(session);
            const prior = existingBalance
              ? new Decimal(existingBalance.onHandQuantity.toString())
              : new Decimal(0);
            item.priorQuantity = toDecimal128(prior.toFixed());
            item.resultingQuantity = toDecimal128(prior.plus(deltaDecimal).toFixed());

            movements.push({
              productId: item.productId,
              warehouseId: doc.warehouseId,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              stockState: item.stockState,
              quantity: deltaDecimal.toFixed(),
            });
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'adjustment',
              referenceType: 'stockAdjustment',
              referenceId: doc._id,
              referenceNumber: doc.adjustmentNumber,
              reasonCode: doc.reasonCode,
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          doc.status = 'posted';
          doc.postedBy = context.actorId;
          doc.postedAt = new Date();
          doc.version += 1;
          await doc.save({ session });

          return { resultRef: doc._id, result: doc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockAdjustmentModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock adjustment not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'adjustments.stockAdjustment.post' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'adjustments.post',
    resourceType: 'stockAdjustment',
    resourceId: stockAdjustment._id,
    resourceNumber: stockAdjustment.adjustmentNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockAdjustment;
}

export async function reverseStockAdjustment(
  context: OrgActionContext,
  stockAdjustmentId: Types.ObjectId,
  reason: string,
  idempotencyKey: string | undefined,
): Promise<StockAdjustmentDoc> {
  const reversal = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'adjustments.reverse',
          key: idempotencyKey,
          requestPayload: { stockAdjustmentId: stockAdjustmentId.toString(), reason },
        },
        session,
        async () => {
          const original = await StockAdjustmentModel.findOne({
            _id: stockAdjustmentId,
            organizationId: context.organizationId,
          }).session(session);
          if (!original) throw new NotFoundError('Stock adjustment not found.');
          if (original.status !== 'posted') {
            throw new BusinessRuleError('Only posted stock adjustments can be reversed.');
          }

          const seq = await nextSequence(
            `${context.organizationId.toString()}:stockAdjustment`,
            session,
          );
          const negatedItems = original.items.map((item) => ({
            lineNumber: item.lineNumber,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            locationId: item.locationId,
            lotId: item.lotId ?? null,
            lotNumber: item.lotNumber ?? null,
            stockState: item.stockState,
            quantityDelta: toDecimal128(
              new Decimal(item.quantityDelta.toString()).negated().toFixed(),
            ),
            priorQuantity: null,
            resultingQuantity: null,
            note: original.notes,
          }));

          const [reversalDoc] = await StockAdjustmentModel.create(
            [
              {
                organizationId: context.organizationId,
                adjustmentNumber: formatSequence('ADJ', seq),
                warehouseId: original.warehouseId,
                status: 'posted',
                reasonCode: original.reasonCode,
                items: negatedItems,
                requiresElevatedApproval: original.requiresElevatedApproval,
                notes: reason,
                reversalOfId: original._id,
                createdBy: context.actorId,
                postedBy: context.actorId,
                postedAt: new Date(),
              },
            ],
            { session },
          );
          if (!reversalDoc) throw new Error('Reversal adjustment creation failed unexpectedly.');

          const movements: StockMovementInput[] = [];
          for (const item of reversalDoc.items) {
            const deltaDecimal = new Decimal(item.quantityDelta.toString());
            const key = {
              organizationId: context.organizationId,
              warehouseId: reversalDoc.warehouseId,
              locationId: item.locationId,
              productId: item.productId,
              lotId: item.lotId ?? null,
              stockState: item.stockState,
            };
            const existingBalance = await StockBalanceModel.findOne(key).session(session);
            const prior = existingBalance
              ? new Decimal(existingBalance.onHandQuantity.toString())
              : new Decimal(0);
            item.priorQuantity = toDecimal128(prior.toFixed());
            item.resultingQuantity = toDecimal128(prior.plus(deltaDecimal).toFixed());

            movements.push({
              productId: item.productId,
              warehouseId: reversalDoc.warehouseId,
              locationId: item.locationId,
              lotId: item.lotId ?? null,
              stockState: item.stockState,
              quantity: deltaDecimal.toFixed(),
            });
          }
          await reversalDoc.save({ session });

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'reversal',
              referenceType: 'stockAdjustment',
              referenceId: reversalDoc._id,
              referenceNumber: reversalDoc.adjustmentNumber,
              reasonCode: 'reversal',
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          original.reversedBy = context.actorId;
          original.reversedAt = new Date();
          await original.save({ session });

          return { resultRef: reversalDoc._id, result: reversalDoc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockAdjustmentModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock adjustment not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'adjustments.stockAdjustment.reverse' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'adjustments.reverse',
    resourceType: 'stockAdjustment',
    resourceId: reversal._id,
    resourceNumber: reversal.adjustmentNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return reversal;
}

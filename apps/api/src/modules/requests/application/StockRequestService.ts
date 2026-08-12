import { Decimal } from 'decimal.js';
import { Types, type ClientSession } from 'mongoose';
import type {
  ApproveStockRequestRequest,
  CreateStockRequestRequest,
  UpdateStockRequestRequest,
} from '@inventory-ms/contracts';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { requestsPolicy } from '../../../config.js';
import { WarehouseModel } from '../../organization/models/Warehouse.js';
import { ProductModel } from '../../catalog/models/Product.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';
import { reserveStock, releaseReservedStock } from '../../inventory/application/LedgerService.js';
import { StockRequestModel, type StockRequestDoc } from '../models/StockRequest.js';
import { assertStockRequestTransition } from '../domain/stockRequestStatus.js';

export interface OrgActionContext {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  correlationId: string;
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

interface ResolvedItem {
  lineNumber: number;
  productId: Types.ObjectId;
  productName: string;
  productSku: string;
  requestedQuantity: ReturnType<typeof toDecimal128>;
  approvedQuantity: ReturnType<typeof toDecimal128>;
  reservedQuantity: ReturnType<typeof toDecimal128>;
  fulfilledQuantity: ReturnType<typeof toDecimal128>;
  note: string | null;
}

async function resolveItems(
  organizationId: Types.ObjectId,
  items: CreateStockRequestRequest['items'],
): Promise<ResolvedItem[]> {
  const productIds = items.map((item) => new Types.ObjectId(item.productId));
  const products = await ProductModel.find({
    _id: { $in: productIds },
    organizationId,
    status: { $ne: 'archived' },
  }).lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  return items.map((item, index) => {
    const product = productById.get(item.productId);
    if (!product) {
      throw new ValidationError(`Product ${item.productId} does not exist or is archived.`);
    }
    return {
      lineNumber: index + 1,
      productId: product._id,
      productName: product.name,
      productSku: product.sku,
      requestedQuantity: toDecimal128(item.requestedQuantity),
      approvedQuantity: toDecimal128('0'),
      reservedQuantity: toDecimal128('0'),
      fulfilledQuantity: toDecimal128('0'),
      note: item.note ?? null,
    };
  });
}

export async function listStockRequests(
  organizationId: Types.ObjectId,
): Promise<StockRequestDoc[]> {
  return StockRequestModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getStockRequestById(
  organizationId: Types.ObjectId,
  stockRequestId: Types.ObjectId,
): Promise<StockRequestDoc> {
  const stockRequest = await StockRequestModel.findOne({
    _id: stockRequestId,
    organizationId,
  }).lean();
  if (!stockRequest) throw new NotFoundError('Stock request not found.');
  return stockRequest;
}

export async function createStockRequest(
  context: OrgActionContext,
  input: CreateStockRequestRequest,
): Promise<StockRequestDoc> {
  const warehouseObjectId = await assertWarehouse(context.organizationId, input.warehouseId);
  const items = await resolveItems(context.organizationId, input.items);

  const stockRequest = await withTransaction(
    async (session) => {
      const seq = await nextSequence(`${context.organizationId.toString()}:stockRequest`, session);
      const [created] = await StockRequestModel.create(
        [
          {
            organizationId: context.organizationId,
            requestNumber: formatSequence('REQ', seq),
            warehouseId: warehouseObjectId,
            status: 'draft',
            neededBy: input.neededBy ? new Date(input.neededBy) : null,
            items,
            notes: input.notes ?? null,
            requestedBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Stock request creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'requests.stockRequest.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_requests.create',
    resourceType: 'stockRequest',
    resourceId: stockRequest._id,
    resourceNumber: stockRequest.requestNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockRequest.toObject();
}

export async function updateStockRequest(
  context: OrgActionContext,
  stockRequestId: Types.ObjectId,
  input: UpdateStockRequestRequest,
): Promise<StockRequestDoc> {
  const stockRequest = await StockRequestModel.findOne({
    _id: stockRequestId,
    organizationId: context.organizationId,
  });
  if (!stockRequest) throw new NotFoundError('Stock request not found.');
  if (stockRequest.status !== 'draft') {
    throw new ValidationError('Only draft stock requests can be edited.');
  }

  const changedFields: Record<string, unknown> = {};

  if (input.warehouseId !== undefined) {
    changedFields['warehouseId'] = true;
    stockRequest.warehouseId = await assertWarehouse(context.organizationId, input.warehouseId);
  }
  if (input.items !== undefined) {
    changedFields['items'] = true;
    const items = await resolveItems(context.organizationId, input.items);
    stockRequest.items = items as unknown as typeof stockRequest.items;
  }
  if (input.neededBy !== undefined) {
    changedFields['neededBy'] = true;
    stockRequest.neededBy = input.neededBy ? new Date(input.neededBy) : null;
  }
  if (input.notes !== undefined) {
    changedFields['notes'] = true;
    stockRequest.notes = input.notes;
  }

  stockRequest.version += 1;
  await stockRequest.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_requests.update',
    resourceType: 'stockRequest',
    resourceId: stockRequest._id,
    resourceNumber: stockRequest.requestNumber,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return stockRequest.toObject();
}

export async function submitStockRequest(
  context: OrgActionContext,
  stockRequestId: Types.ObjectId,
): Promise<StockRequestDoc> {
  const stockRequest = await StockRequestModel.findOne({
    _id: stockRequestId,
    organizationId: context.organizationId,
  });
  if (!stockRequest) throw new NotFoundError('Stock request not found.');

  assertStockRequestTransition(stockRequest.status, 'submitted');
  stockRequest.status = 'submitted';
  stockRequest.submittedBy = context.actorId;
  stockRequest.submittedAt = new Date();
  stockRequest.version += 1;
  await stockRequest.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_requests.submit',
    resourceType: 'stockRequest',
    resourceId: stockRequest._id,
    resourceNumber: stockRequest.requestNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockRequest.toObject();
}

export async function approveStockRequest(
  context: OrgActionContext,
  stockRequestId: Types.ObjectId,
  input: ApproveStockRequestRequest,
): Promise<StockRequestDoc> {
  const existing = await StockRequestModel.findOne({
    _id: stockRequestId,
    organizationId: context.organizationId,
  }).lean();
  if (!existing) throw new NotFoundError('Stock request not found.');
  if (requestsPolicy.preventSelfApproval && existing.requestedBy?.equals(context.actorId)) {
    throw new BusinessRuleError('You cannot approve a stock request you created.');
  }
  assertStockRequestTransition(existing.status, 'approved');

  const overridesByLine = new Map((input.items ?? []).map((item) => [item.lineNumber, item]));

  const approved = await withTransaction(
    async (session) => {
      const stockRequest = await StockRequestModel.findOne({
        _id: stockRequestId,
        organizationId: context.organizationId,
      }).session(session);
      if (!stockRequest) throw new NotFoundError('Stock request not found.');
      assertStockRequestTransition(stockRequest.status, 'approved');

      let totalApproved = new Decimal(0);

      for (const item of stockRequest.items) {
        const override = overridesByLine.get(item.lineNumber);
        const requested = new Decimal(item.requestedQuantity.toString());
        const approvedQuantity = override
          ? new Decimal(override.approvedQuantity)
          : requested;
        if (approvedQuantity.greaterThan(requested)) {
          throw new ValidationError(
            `Line ${String(item.lineNumber)} cannot approve more than the requested quantity.`,
          );
        }
        item.approvedQuantity = toDecimal128(approvedQuantity.toFixed());
        totalApproved = totalApproved.plus(approvedQuantity);

        if (approvedQuantity.greaterThan(0)) {
          await reserveStock(
            context.organizationId,
            stockRequest.warehouseId,
            item.productId,
            approvedQuantity.toFixed(),
            session,
          );
          item.reservedQuantity = toDecimal128(approvedQuantity.toFixed());
        }
      }

      if (totalApproved.lessThanOrEqualTo(0)) {
        throw new ValidationError('At least one line must be approved with a quantity above zero.');
      }

      stockRequest.status = 'approved';
      stockRequest.approvedBy = context.actorId;
      stockRequest.approvedAt = new Date();
      stockRequest.version += 1;
      await stockRequest.save({ session });

      return stockRequest.toObject();
    },
    { correlationId: context.correlationId, operation: 'requests.stockRequest.approve' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_requests.approve',
    resourceType: 'stockRequest',
    resourceId: approved._id,
    resourceNumber: approved.requestNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return approved;
}

export async function rejectStockRequest(
  context: OrgActionContext,
  stockRequestId: Types.ObjectId,
  reason: string,
): Promise<StockRequestDoc> {
  const stockRequest = await StockRequestModel.findOne({
    _id: stockRequestId,
    organizationId: context.organizationId,
  });
  if (!stockRequest) throw new NotFoundError('Stock request not found.');

  assertStockRequestTransition(stockRequest.status, 'rejected');
  stockRequest.status = 'rejected';
  stockRequest.rejectedBy = context.actorId;
  stockRequest.rejectedAt = new Date();
  stockRequest.rejectionReason = reason;
  stockRequest.version += 1;
  await stockRequest.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_requests.reject',
    resourceType: 'stockRequest',
    resourceId: stockRequest._id,
    resourceNumber: stockRequest.requestNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return stockRequest.toObject();
}

export async function cancelStockRequest(
  context: OrgActionContext,
  stockRequestId: Types.ObjectId,
  reason: string,
): Promise<StockRequestDoc> {
  const existing = await StockRequestModel.findOne({
    _id: stockRequestId,
    organizationId: context.organizationId,
  }).lean();
  if (!existing) throw new NotFoundError('Stock request not found.');
  assertStockRequestTransition(existing.status, 'cancelled');

  const cancelled = await withTransaction(
    async (session) => {
      const stockRequest = await StockRequestModel.findOne({
        _id: stockRequestId,
        organizationId: context.organizationId,
      }).session(session);
      if (!stockRequest) throw new NotFoundError('Stock request not found.');
      assertStockRequestTransition(stockRequest.status, 'cancelled');

      for (const item of stockRequest.items) {
        const reserved = new Decimal(item.reservedQuantity.toString());
        if (reserved.greaterThan(0)) {
          await releaseReservedStock(
            context.organizationId,
            stockRequest.warehouseId,
            item.productId,
            reserved.toFixed(),
            session,
          );
          item.reservedQuantity = toDecimal128('0');
        }
      }

      stockRequest.status = 'cancelled';
      stockRequest.cancelledBy = context.actorId;
      stockRequest.cancelledAt = new Date();
      stockRequest.cancellationReason = reason;
      stockRequest.version += 1;
      await stockRequest.save({ session });

      return stockRequest.toObject();
    },
    { correlationId: context.correlationId, operation: 'requests.stockRequest.cancel' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'stock_requests.cancel',
    resourceType: 'stockRequest',
    resourceId: cancelled._id,
    resourceNumber: cancelled.requestNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return cancelled;
}

/**
 * Applies signed fulfillment deltas per product (positive when an issue
 * posts, negative when one is reversed), releasing reserved quantity only
 * on the positive path, and recomputing the derived fulfillment status.
 * Exposed as an application function -- not a shared model -- so the
 * Issues module never imports `StockRequestModel` directly (no cross-module
 * model imports).
 */
export async function applyIssuedQuantities(
  session: ClientSession,
  organizationId: Types.ObjectId,
  stockRequestId: Types.ObjectId,
  deltaByProductId: ReadonlyMap<string, Decimal>,
): Promise<void> {
  const stockRequest = await StockRequestModel.findOne({
    _id: stockRequestId,
    organizationId,
  }).session(session);
  if (!stockRequest) throw new NotFoundError('Stock request not found.');

  let totalApproved = new Decimal(0);
  let totalFulfilled = new Decimal(0);

  for (const item of stockRequest.items) {
    const delta = deltaByProductId.get(item.productId.toString());
    if (delta?.greaterThan(0)) {
      await releaseReservedStock(
        organizationId,
        stockRequest.warehouseId,
        item.productId,
        Decimal.min(delta, new Decimal(item.reservedQuantity.toString())).toFixed(),
        session,
      );
      const remainingReserved = Decimal.max(
        0,
        new Decimal(item.reservedQuantity.toString()).minus(delta),
      );
      item.reservedQuantity = toDecimal128(remainingReserved.toFixed());
    }
    if (delta && !delta.isZero()) {
      const nextFulfilled = Decimal.max(
        0,
        new Decimal(item.fulfilledQuantity.toString()).plus(delta),
      );
      item.fulfilledQuantity = toDecimal128(nextFulfilled.toFixed());
    }
    totalApproved = totalApproved.plus(item.approvedQuantity.toString());
    totalFulfilled = totalFulfilled.plus(item.fulfilledQuantity.toString());
  }

  if (totalFulfilled.greaterThan(0)) {
    stockRequest.status = totalFulfilled.greaterThanOrEqualTo(totalApproved)
      ? 'fulfilled'
      : 'partially_fulfilled';
  } else if (stockRequest.status === 'partially_fulfilled' || stockRequest.status === 'fulfilled') {
    stockRequest.status = 'approved';
  }

  stockRequest.version += 1;
  await stockRequest.save({ session });
}

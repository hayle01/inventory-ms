import { Decimal } from 'decimal.js';
import { Types } from 'mongoose';
import type { CreateStockTransferRequest, StockTransferItemInput } from '@inventory-ms/contracts';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import {
  hashIdempotencyPayload,
  withIdempotentPost,
} from '../../../shared/infrastructure/idempotency.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { transfersPolicy } from '../../../config.js';
import { WarehouseModel } from '../../organization/models/Warehouse.js';
import { StorageLocationModel } from '../../organization/models/StorageLocation.js';
import { ProductModel } from '../../catalog/models/Product.js';
import { InventoryLotModel } from '../../inventory/models/InventoryLot.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';
import {
  postStockMovements,
  type StockMovementInput,
} from '../../inventory/application/LedgerService.js';
import { StockTransferModel, type StockTransferDoc } from '../models/StockTransfer.js';
import { assertStockTransferTransition } from '../domain/stockTransferStatus.js';

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
  sourceLocationId: Types.ObjectId;
  destinationLocationId: Types.ObjectId;
  lotId: Types.ObjectId | null;
  lotNumber: string | null;
  quantity: ReturnType<typeof toDecimal128>;
  note: string | null;
}

async function assertWarehouses(
  organizationId: Types.ObjectId,
  sourceWarehouseId: string,
  destinationWarehouseId: string,
): Promise<{ sourceObjectId: Types.ObjectId; destinationObjectId: Types.ObjectId }> {
  const sourceObjectId = new Types.ObjectId(sourceWarehouseId);
  const destinationObjectId = new Types.ObjectId(destinationWarehouseId);

  const [source, destination] = await Promise.all([
    WarehouseModel.findOne({ _id: sourceObjectId, organizationId, status: { $ne: 'archived' } }).lean(),
    WarehouseModel.findOne({
      _id: destinationObjectId,
      organizationId,
      status: { $ne: 'archived' },
    }).lean(),
  ]);
  if (!source) throw new ValidationError('Source warehouse does not exist or is archived.');
  if (!destination) throw new ValidationError('Destination warehouse does not exist or is archived.');

  return { sourceObjectId, destinationObjectId };
}

async function resolveItems(
  organizationId: Types.ObjectId,
  sourceWarehouseId: Types.ObjectId,
  destinationWarehouseId: Types.ObjectId,
  items: readonly StockTransferItemInput[],
): Promise<ResolvedItem[]> {
  const productIds = items.map((item) => new Types.ObjectId(item.productId));
  const sourceLocationIds = items.map((item) => new Types.ObjectId(item.sourceLocationId));
  const destinationLocationIds = items.map((item) => new Types.ObjectId(item.destinationLocationId));
  const lotIds = items
    .filter((item): item is StockTransferItemInput & { lotId: string } => Boolean(item.lotId))
    .map((item) => new Types.ObjectId(item.lotId));

  const [products, sourceLocations, destinationLocations, lots] = await Promise.all([
    ProductModel.find({
      _id: { $in: productIds },
      organizationId,
      status: { $ne: 'archived' },
    }).lean(),
    StorageLocationModel.find({
      _id: { $in: sourceLocationIds },
      organizationId,
      warehouseId: sourceWarehouseId,
      status: { $ne: 'archived' },
    }).lean(),
    StorageLocationModel.find({
      _id: { $in: destinationLocationIds },
      organizationId,
      warehouseId: destinationWarehouseId,
      status: { $ne: 'archived' },
    }).lean(),
    lotIds.length > 0
      ? InventoryLotModel.find({ _id: { $in: lotIds }, organizationId }).lean()
      : Promise.resolve([]),
  ]);
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  const sourceLocationById = new Map(sourceLocations.map((location) => [location._id.toString(), location]));
  const destinationLocationById = new Map(
    destinationLocations.map((location) => [location._id.toString(), location]),
  );
  const lotById = new Map(lots.map((lot) => [lot._id.toString(), lot]));

  return items.map((item, index) => {
    const product = productById.get(item.productId);
    if (!product) throw new ValidationError(`Product ${item.productId} does not exist or is archived.`);
    const sourceLocation = sourceLocationById.get(item.sourceLocationId);
    if (!sourceLocation) {
      throw new ValidationError(
        `Source location ${item.sourceLocationId} does not exist in the source warehouse or is archived.`,
      );
    }
    const destinationLocation = destinationLocationById.get(item.destinationLocationId);
    if (!destinationLocation) {
      throw new ValidationError(
        `Destination location ${item.destinationLocationId} does not exist in the destination warehouse or is archived.`,
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
      sourceLocationId: sourceLocation._id,
      destinationLocationId: destinationLocation._id,
      lotId: lot?._id ?? null,
      lotNumber: lot?.lotNumber ?? null,
      quantity: toDecimal128(item.quantity),
      note: item.note ?? null,
    };
  });
}

export async function listStockTransfers(organizationId: Types.ObjectId): Promise<StockTransferDoc[]> {
  return StockTransferModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getStockTransferById(
  organizationId: Types.ObjectId,
  stockTransferId: Types.ObjectId,
): Promise<StockTransferDoc> {
  const stockTransfer = await StockTransferModel.findOne({
    _id: stockTransferId,
    organizationId,
  }).lean();
  if (!stockTransfer) throw new NotFoundError('Stock transfer not found.');
  return stockTransfer;
}

export async function createStockTransfer(
  context: OrgActionContext,
  input: CreateStockTransferRequest,
): Promise<StockTransferDoc> {
  const { sourceObjectId, destinationObjectId } = await assertWarehouses(
    context.organizationId,
    input.sourceWarehouseId,
    input.destinationWarehouseId,
  );
  const items = await resolveItems(
    context.organizationId,
    sourceObjectId,
    destinationObjectId,
    input.items,
  );

  const stockTransfer = await withTransaction(
    async (session) => {
      const seq = await nextSequence(`${context.organizationId.toString()}:stockTransfer`, session);
      const [created] = await StockTransferModel.create(
        [
          {
            organizationId: context.organizationId,
            transferNumber: formatSequence('TRF', seq),
            sourceWarehouseId: sourceObjectId,
            destinationWarehouseId: destinationObjectId,
            status: 'draft',
            inTransitPolicy: input.inTransitPolicy,
            items,
            notes: input.notes ?? null,
            createdBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Stock transfer creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'transfers.stockTransfer.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'transfers.create',
    resourceType: 'stockTransfer',
    resourceId: stockTransfer._id,
    resourceNumber: stockTransfer.transferNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockTransfer.toObject();
}

export async function submitStockTransfer(
  context: OrgActionContext,
  stockTransferId: Types.ObjectId,
): Promise<StockTransferDoc> {
  const stockTransfer = await StockTransferModel.findOne({
    _id: stockTransferId,
    organizationId: context.organizationId,
  });
  if (!stockTransfer) throw new NotFoundError('Stock transfer not found.');

  assertStockTransferTransition(stockTransfer.status, 'submitted');
  stockTransfer.status = 'submitted';
  stockTransfer.submittedBy = context.actorId;
  stockTransfer.submittedAt = new Date();
  stockTransfer.version += 1;
  await stockTransfer.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'transfers.submit',
    resourceType: 'stockTransfer',
    resourceId: stockTransfer._id,
    resourceNumber: stockTransfer.transferNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockTransfer.toObject();
}

export async function approveStockTransfer(
  context: OrgActionContext,
  stockTransferId: Types.ObjectId,
): Promise<StockTransferDoc> {
  const stockTransfer = await StockTransferModel.findOne({
    _id: stockTransferId,
    organizationId: context.organizationId,
  });
  if (!stockTransfer) throw new NotFoundError('Stock transfer not found.');
  if (transfersPolicy.preventSelfApproval && stockTransfer.createdBy?.equals(context.actorId)) {
    throw new ForbiddenError('You cannot approve a stock transfer you created.');
  }

  assertStockTransferTransition(stockTransfer.status, 'approved');
  stockTransfer.status = 'approved';
  stockTransfer.approvedBy = context.actorId;
  stockTransfer.approvedAt = new Date();
  stockTransfer.version += 1;
  await stockTransfer.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'transfers.approve',
    resourceType: 'stockTransfer',
    resourceId: stockTransfer._id,
    resourceNumber: stockTransfer.transferNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockTransfer.toObject();
}

export async function postStockTransfer(
  context: OrgActionContext,
  stockTransferId: Types.ObjectId,
  idempotencyKey: string | undefined,
): Promise<StockTransferDoc> {
  const stockTransfer = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'transfers.post',
          key: idempotencyKey,
          requestPayload: { stockTransferId: stockTransferId.toString() },
        },
        session,
        async () => {
          const doc = await StockTransferModel.findOne({
            _id: stockTransferId,
            organizationId: context.organizationId,
          }).session(session);
          if (!doc) throw new NotFoundError('Stock transfer not found.');

          const immediate = doc.inTransitPolicy === 'immediate';
          const targetStatus = immediate ? 'completed' : 'in_transit';
          assertStockTransferTransition(doc.status, targetStatus);

          const movements: StockMovementInput[] = [];
          for (const item of doc.items) {
            const quantityDecimal = new Decimal(item.quantity.toString());
            movements.push({
              productId: item.productId,
              warehouseId: doc.sourceWarehouseId,
              locationId: item.sourceLocationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: quantityDecimal.negated().toFixed(),
            });
            movements.push({
              productId: item.productId,
              warehouseId: doc.destinationWarehouseId,
              locationId: item.destinationLocationId,
              lotId: item.lotId ?? null,
              stockState: immediate ? 'available' : 'in_transit',
              quantity: quantityDecimal.toFixed(),
            });
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'transfer',
              referenceType: 'stockTransfer',
              referenceId: doc._id,
              referenceNumber: doc.transferNumber,
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          doc.status = targetStatus;
          doc.postedBy = context.actorId;
          doc.postedAt = new Date();
          if (immediate) {
            doc.receivedBy = context.actorId;
            doc.receivedAt = new Date();
          }
          doc.version += 1;
          await doc.save({ session });

          return { resultRef: doc._id, result: doc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockTransferModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock transfer not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'transfers.stockTransfer.post' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'transfers.post',
    resourceType: 'stockTransfer',
    resourceId: stockTransfer._id,
    resourceNumber: stockTransfer.transferNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockTransfer;
}

export async function receiveStockTransfer(
  context: OrgActionContext,
  stockTransferId: Types.ObjectId,
  idempotencyKey: string | undefined,
): Promise<StockTransferDoc> {
  const stockTransfer = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'transfers.receive',
          key: idempotencyKey,
          requestPayload: { stockTransferId: stockTransferId.toString() },
        },
        session,
        async () => {
          const doc = await StockTransferModel.findOne({
            _id: stockTransferId,
            organizationId: context.organizationId,
          }).session(session);
          if (!doc) throw new NotFoundError('Stock transfer not found.');
          assertStockTransferTransition(doc.status, 'completed');

          const movements: StockMovementInput[] = [];
          for (const item of doc.items) {
            const quantityDecimal = new Decimal(item.quantity.toString());
            movements.push({
              productId: item.productId,
              warehouseId: doc.destinationWarehouseId,
              locationId: item.destinationLocationId,
              lotId: item.lotId ?? null,
              stockState: 'in_transit',
              quantity: quantityDecimal.negated().toFixed(),
            });
            movements.push({
              productId: item.productId,
              warehouseId: doc.destinationWarehouseId,
              locationId: item.destinationLocationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: quantityDecimal.toFixed(),
            });
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'transfer',
              referenceType: 'stockTransfer',
              referenceId: doc._id,
              referenceNumber: doc.transferNumber,
              reasonCode: 'transfer_receive',
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          doc.status = 'completed';
          doc.receivedBy = context.actorId;
          doc.receivedAt = new Date();
          doc.version += 1;
          await doc.save({ session });

          return { resultRef: doc._id, result: doc.toObject() };
        },
        async (resultRef) => {
          const existing = await StockTransferModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock transfer not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'transfers.stockTransfer.receive' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'transfers.receive',
    resourceType: 'stockTransfer',
    resourceId: stockTransfer._id,
    resourceNumber: stockTransfer.transferNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return stockTransfer;
}

export async function reverseStockTransfer(
  context: OrgActionContext,
  stockTransferId: Types.ObjectId,
  reason: string,
  idempotencyKey: string | undefined,
): Promise<StockTransferDoc> {
  const reversal = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'transfers.reverse',
          key: idempotencyKey,
          requestPayload: { stockTransferId: stockTransferId.toString(), reason },
        },
        session,
        async () => {
          const original = await StockTransferModel.findOne({
            _id: stockTransferId,
            organizationId: context.organizationId,
          }).session(session);
          if (!original) throw new NotFoundError('Stock transfer not found.');
          if (original.status !== 'completed') {
            throw new BusinessRuleError('Only completed stock transfers can be reversed.');
          }

          const seq = await nextSequence(
            `${context.organizationId.toString()}:stockTransfer`,
            session,
          );
          const [reversalDoc] = await StockTransferModel.create(
            [
              {
                organizationId: context.organizationId,
                transferNumber: formatSequence('TRF', seq),
                sourceWarehouseId: original.destinationWarehouseId,
                destinationWarehouseId: original.sourceWarehouseId,
                status: 'completed',
                inTransitPolicy: 'immediate',
                items: original.items.map((item) => ({
                  lineNumber: item.lineNumber,
                  productId: item.productId,
                  productName: item.productName,
                  productSku: item.productSku,
                  sourceLocationId: item.destinationLocationId,
                  destinationLocationId: item.sourceLocationId,
                  lotId: item.lotId ?? null,
                  lotNumber: item.lotNumber ?? null,
                  quantity: item.quantity,
                  note: original.notes,
                })),
                notes: reason,
                reversalOfId: original._id,
                createdBy: context.actorId,
                postedBy: context.actorId,
                postedAt: new Date(),
                receivedBy: context.actorId,
                receivedAt: new Date(),
              },
            ],
            { session },
          );
          if (!reversalDoc) throw new Error('Reversal transfer creation failed unexpectedly.');

          const movements: StockMovementInput[] = [];
          for (const item of reversalDoc.items) {
            const quantityDecimal = new Decimal(item.quantity.toString());
            movements.push({
              productId: item.productId,
              warehouseId: reversalDoc.sourceWarehouseId,
              locationId: item.sourceLocationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: quantityDecimal.negated().toFixed(),
            });
            movements.push({
              productId: item.productId,
              warehouseId: reversalDoc.destinationWarehouseId,
              locationId: item.destinationLocationId,
              lotId: item.lotId ?? null,
              stockState: 'available',
              quantity: quantityDecimal.toFixed(),
            });
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'reversal',
              referenceType: 'stockTransfer',
              referenceId: reversalDoc._id,
              referenceNumber: reversalDoc.transferNumber,
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
          const existing = await StockTransferModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Stock transfer not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'transfers.stockTransfer.reverse' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'transfers.reverse',
    resourceType: 'stockTransfer',
    resourceId: reversal._id,
    resourceNumber: reversal.transferNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return reversal;
}

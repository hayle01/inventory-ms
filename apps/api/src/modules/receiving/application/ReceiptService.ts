import { Decimal } from 'decimal.js';
import { Types, type ClientSession } from 'mongoose';
import type {
  CreateGoodsReceiptRequest,
  GoodsReceiptItemInput,
  UpdateGoodsReceiptRequest,
} from '@inventory-ms/contracts';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import {
  hashIdempotencyPayload,
  withIdempotentPost,
} from '../../../shared/infrastructure/idempotency.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { SupplierModel } from '../../suppliers/models/Supplier.js';
import { WarehouseModel } from '../../organization/models/Warehouse.js';
import { StorageLocationModel } from '../../organization/models/StorageLocation.js';
import { ProductModel } from '../../catalog/models/Product.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';
import {
  getPurchaseOrderById,
  applyReceivedQuantities,
} from '../../procurement/application/PurchaseOrderService.js';
import { InventoryLotModel } from '../../inventory/models/InventoryLot.js';
import {
  postStockMovements,
  type StockMovementInput,
} from '../../inventory/application/LedgerService.js';
import { GoodsReceiptModel, type GoodsReceiptDoc } from '../models/GoodsReceipt.js';
import { assertReceiptTransition } from '../domain/receiptStatus.js';

export interface OrgActionContext {
  organizationId: Types.ObjectId;
  actorId: Types.ObjectId;
  correlationId: string;
}

async function assertSupplierAndWarehouse(
  organizationId: Types.ObjectId,
  supplierId: string,
  warehouseId: string,
): Promise<{ supplierObjectId: Types.ObjectId; warehouseObjectId: Types.ObjectId }> {
  const supplierObjectId = new Types.ObjectId(supplierId);
  const warehouseObjectId = new Types.ObjectId(warehouseId);

  const [supplier, warehouse] = await Promise.all([
    SupplierModel.findOne({
      _id: supplierObjectId,
      organizationId,
      status: { $ne: 'archived' },
    }).lean(),
    WarehouseModel.findOne({
      _id: warehouseObjectId,
      organizationId,
      status: { $ne: 'archived' },
    }).lean(),
  ]);
  if (!supplier) throw new ValidationError('Supplier does not exist or is archived.');
  if (!warehouse) throw new ValidationError('Warehouse does not exist or is archived.');

  return { supplierObjectId, warehouseObjectId };
}

interface ResolvedItem {
  lineNumber: number;
  productId: Types.ObjectId;
  productName: string;
  productSku: string;
  destinationLocationId: Types.ObjectId;
  receivedQuantity: ReturnType<typeof toDecimal128>;
  acceptedQuantity: ReturnType<typeof toDecimal128>;
  rejectedQuantity: ReturnType<typeof toDecimal128>;
  unitCost: ReturnType<typeof toDecimal128>;
  condition: GoodsReceiptItemInput['condition'];
  lotNumber: string | null;
  manufacturedAt: Date | null;
  expiresAt: Date | null;
  notes: string | null;
}

async function resolveItems(
  organizationId: Types.ObjectId,
  warehouseObjectId: Types.ObjectId,
  items: readonly GoodsReceiptItemInput[],
): Promise<ResolvedItem[]> {
  const productIds = items.map((item) => new Types.ObjectId(item.productId));
  const locationIds = items.map((item) => new Types.ObjectId(item.destinationLocationId));

  const [products, locations] = await Promise.all([
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
  ]);
  const productById = new Map(products.map((product) => [product._id.toString(), product]));
  const locationById = new Map(locations.map((location) => [location._id.toString(), location]));

  return items.map((item, index) => {
    const product = productById.get(item.productId);
    if (!product)
      throw new ValidationError(`Product ${item.productId} does not exist or is archived.`);
    const location = locationById.get(item.destinationLocationId);
    if (!location) {
      throw new ValidationError(
        `Destination location ${item.destinationLocationId} does not exist in this warehouse or is archived.`,
      );
    }

    const acceptedDecimal = new Decimal(item.acceptedQuantity);
    if (acceptedDecimal.greaterThan(0)) {
      if (product.trackLots && !item.lotNumber) {
        throw new ValidationError(
          `Product ${product.sku} requires a lot number for accepted stock.`,
        );
      }
      if (product.trackExpiry && !item.expiresAt) {
        throw new ValidationError(
          `Product ${product.sku} requires an expiry date for accepted stock.`,
        );
      }
    }

    return {
      lineNumber: index + 1,
      productId: product._id,
      productName: product.name,
      productSku: product.sku,
      destinationLocationId: location._id,
      receivedQuantity: toDecimal128(item.receivedQuantity),
      acceptedQuantity: toDecimal128(item.acceptedQuantity),
      rejectedQuantity: toDecimal128(item.rejectedQuantity),
      unitCost: toDecimal128(item.unitCost),
      condition: item.condition,
      lotNumber: item.lotNumber ?? null,
      manufacturedAt: item.manufacturedAt ? new Date(item.manufacturedAt) : null,
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
      notes: item.notes ?? null,
    };
  });
}

export async function listReceipts(organizationId: Types.ObjectId): Promise<GoodsReceiptDoc[]> {
  return GoodsReceiptModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getReceiptById(
  organizationId: Types.ObjectId,
  receiptId: Types.ObjectId,
): Promise<GoodsReceiptDoc> {
  const receipt = await GoodsReceiptModel.findOne({ _id: receiptId, organizationId }).lean();
  if (!receipt) throw new NotFoundError('Goods receipt not found.');
  return receipt;
}

export async function createReceipt(
  context: OrgActionContext,
  input: CreateGoodsReceiptRequest,
): Promise<GoodsReceiptDoc> {
  const { supplierObjectId, warehouseObjectId } = await assertSupplierAndWarehouse(
    context.organizationId,
    input.supplierId,
    input.warehouseId,
  );

  let purchaseOrderObjectId: Types.ObjectId | null = null;
  if (input.purchaseOrderId) {
    const po = await getPurchaseOrderById(
      context.organizationId,
      new Types.ObjectId(input.purchaseOrderId),
    );
    if (!['approved', 'partially_received'].includes(po.status)) {
      throw new ValidationError('The purchase order must be approved before receiving against it.');
    }
    if (po.warehouseId.toString() !== input.warehouseId) {
      throw new ValidationError('The purchase order was raised against a different warehouse.');
    }
    purchaseOrderObjectId = po._id;
  }

  const items = await resolveItems(context.organizationId, warehouseObjectId, input.items);

  const receipt = await withTransaction(
    async (session) => {
      const seq = await nextSequence(`${context.organizationId.toString()}:goodsReceipt`, session);
      const [created] = await GoodsReceiptModel.create(
        [
          {
            organizationId: context.organizationId,
            receiptNumber: formatSequence('GRN', seq),
            purchaseOrderId: purchaseOrderObjectId,
            supplierId: supplierObjectId,
            warehouseId: warehouseObjectId,
            status: 'draft',
            receivedDate: input.receivedDate ? new Date(input.receivedDate) : null,
            supplierDocumentNumber: input.supplierDocumentNumber ?? null,
            items,
            notes: input.notes ?? null,
            createdBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Goods receipt creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'receiving.goodsReceipt.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'receipts.create',
    resourceType: 'goodsReceipt',
    resourceId: receipt._id,
    resourceNumber: receipt.receiptNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return receipt.toObject();
}

export async function updateReceipt(
  context: OrgActionContext,
  receiptId: Types.ObjectId,
  input: UpdateGoodsReceiptRequest,
): Promise<GoodsReceiptDoc> {
  const receipt = await GoodsReceiptModel.findOne({
    _id: receiptId,
    organizationId: context.organizationId,
  });
  if (!receipt) throw new NotFoundError('Goods receipt not found.');
  if (receipt.status !== 'draft')
    throw new ValidationError('Only draft goods receipts can be edited.');

  const changedFields: Record<string, unknown> = {};
  let warehouseObjectId = receipt.warehouseId;

  if (input.supplierId !== undefined || input.warehouseId !== undefined) {
    const { supplierObjectId, warehouseObjectId: nextWarehouseId } =
      await assertSupplierAndWarehouse(
        context.organizationId,
        input.supplierId ?? receipt.supplierId.toString(),
        input.warehouseId ?? receipt.warehouseId.toString(),
      );
    if (input.supplierId !== undefined) {
      changedFields['supplierId'] = true;
      receipt.supplierId = supplierObjectId;
    }
    if (input.warehouseId !== undefined) {
      changedFields['warehouseId'] = true;
      receipt.warehouseId = nextWarehouseId;
      warehouseObjectId = nextWarehouseId;
    }
  }

  if (input.items !== undefined) {
    changedFields['items'] = true;
    const items = await resolveItems(context.organizationId, warehouseObjectId, input.items);
    receipt.items = items as unknown as typeof receipt.items;
  }

  if (input.purchaseOrderId !== undefined) {
    changedFields['purchaseOrderId'] = true;
    receipt.purchaseOrderId = input.purchaseOrderId
      ? new Types.ObjectId(input.purchaseOrderId)
      : null;
  }
  if (input.receivedDate !== undefined) {
    changedFields['receivedDate'] = true;
    receipt.receivedDate = input.receivedDate ? new Date(input.receivedDate) : null;
  }
  if (input.supplierDocumentNumber !== undefined) {
    changedFields['supplierDocumentNumber'] = true;
    receipt.supplierDocumentNumber = input.supplierDocumentNumber;
  }
  if (input.notes !== undefined) {
    changedFields['notes'] = true;
    receipt.notes = input.notes;
  }

  receipt.version += 1;
  await receipt.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'receipts.update',
    resourceType: 'goodsReceipt',
    resourceId: receipt._id,
    resourceNumber: receipt.receiptNumber,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return receipt.toObject();
}

export async function verifyReceipt(
  context: OrgActionContext,
  receiptId: Types.ObjectId,
): Promise<GoodsReceiptDoc> {
  const receipt = await GoodsReceiptModel.findOne({
    _id: receiptId,
    organizationId: context.organizationId,
  });
  if (!receipt) throw new NotFoundError('Goods receipt not found.');
  assertReceiptTransition(receipt.status, 'verified');

  receipt.status = 'verified';
  receipt.verifiedBy = context.actorId;
  receipt.verifiedAt = new Date();
  receipt.version += 1;
  await receipt.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'receipts.verify',
    resourceType: 'goodsReceipt',
    resourceId: receipt._id,
    resourceNumber: receipt.receiptNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return receipt.toObject();
}

async function resolveOrCreateLot(
  session: ClientSession,
  organizationId: Types.ObjectId,
  productId: Types.ObjectId,
  lotNumber: string,
  manufacturedAt: Date | null,
  expiresAt: Date | null,
): Promise<Types.ObjectId> {
  const lot = await InventoryLotModel.findOneAndUpdate(
    { organizationId, productId, lotNumber },
    {
      $setOnInsert: {
        organizationId,
        productId,
        lotNumber,
        manufacturedAt,
        expiresAt,
        receivedAt: new Date(),
        status: 'active',
      },
    },
    { upsert: true, new: true, session },
  );
  return lot._id;
}

function stockStateForCondition(condition: GoodsReceiptItemInput['condition']) {
  return condition === 'good' ? ('available' as const) : condition;
}

export async function postReceipt(
  context: OrgActionContext,
  receiptId: Types.ObjectId,
  idempotencyKey: string | undefined,
): Promise<GoodsReceiptDoc> {
  const receipt = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'receipts.post',
          key: idempotencyKey,
          requestPayload: { receiptId: receiptId.toString() },
        },
        session,
        async () => {
          const doc = await GoodsReceiptModel.findOne({
            _id: receiptId,
            organizationId: context.organizationId,
          }).session(session);
          if (!doc) throw new NotFoundError('Goods receipt not found.');
          assertReceiptTransition(doc.status, 'posted');

          const movements: StockMovementInput[] = [];
          const receivedByProduct = new Map<string, Decimal>();

          for (const item of doc.items) {
            const acceptedDecimal = new Decimal(item.acceptedQuantity.toString());
            if (acceptedDecimal.isZero()) continue;

            let lotId: Types.ObjectId | null = null;
            if (item.lotNumber) {
              lotId = await resolveOrCreateLot(
                session,
                context.organizationId,
                item.productId,
                item.lotNumber,
                item.manufacturedAt ?? null,
                item.expiresAt ?? null,
              );
            }

            movements.push({
              productId: item.productId,
              warehouseId: doc.warehouseId,
              locationId: item.destinationLocationId,
              lotId,
              stockState: stockStateForCondition(item.condition),
              quantity: acceptedDecimal.toFixed(),
              unitCost: item.unitCost.toString(),
            });

            const key = item.productId.toString();
            receivedByProduct.set(
              key,
              (receivedByProduct.get(key) ?? new Decimal(0)).plus(acceptedDecimal),
            );
          }

          if (movements.length === 0) {
            throw new BusinessRuleError('This receipt has no accepted quantity to post.');
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'receipt',
              referenceType: 'goodsReceipt',
              referenceId: doc._id,
              referenceNumber: doc.receiptNumber,
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          if (doc.purchaseOrderId && receivedByProduct.size > 0) {
            await applyReceivedQuantities(
              session,
              context.organizationId,
              doc.purchaseOrderId,
              receivedByProduct,
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
          const existing = await GoodsReceiptModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Goods receipt not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'receiving.goodsReceipt.post' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'receipts.post',
    resourceType: 'goodsReceipt',
    resourceId: receipt._id,
    resourceNumber: receipt.receiptNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return receipt;
}

export async function reverseReceipt(
  context: OrgActionContext,
  receiptId: Types.ObjectId,
  reason: string,
  idempotencyKey: string | undefined,
): Promise<GoodsReceiptDoc> {
  const reversal = await withTransaction(
    (session) =>
      withIdempotentPost(
        {
          organizationId: context.organizationId,
          scope: 'receipts.reverse',
          key: idempotencyKey,
          requestPayload: { receiptId: receiptId.toString(), reason },
        },
        session,
        async () => {
          const original = await GoodsReceiptModel.findOne({
            _id: receiptId,
            organizationId: context.organizationId,
          }).session(session);
          if (!original) throw new NotFoundError('Goods receipt not found.');
          if (original.status !== 'posted') {
            throw new BusinessRuleError('Only posted goods receipts can be reversed.');
          }

          const seq = await nextSequence(
            `${context.organizationId.toString()}:goodsReceipt`,
            session,
          );
          const [reversalDoc] = await GoodsReceiptModel.create(
            [
              {
                organizationId: context.organizationId,
                receiptNumber: formatSequence('GRN', seq),
                purchaseOrderId: original.purchaseOrderId,
                supplierId: original.supplierId,
                warehouseId: original.warehouseId,
                status: 'posted',
                receivedDate: new Date(),
                supplierDocumentNumber: original.supplierDocumentNumber,
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
          if (!reversalDoc) throw new Error('Reversal receipt creation failed unexpectedly.');

          const movements: StockMovementInput[] = [];
          const receivedByProduct = new Map<string, Decimal>();

          for (const item of original.items) {
            const acceptedDecimal = new Decimal(item.acceptedQuantity.toString());
            if (acceptedDecimal.isZero()) continue;

            let lotId: Types.ObjectId | null = null;
            if (item.lotNumber) {
              const lot = await InventoryLotModel.findOne({
                organizationId: context.organizationId,
                productId: item.productId,
                lotNumber: item.lotNumber,
              }).session(session);
              lotId = lot?._id ?? null;
            }

            movements.push({
              productId: item.productId,
              warehouseId: original.warehouseId,
              locationId: item.destinationLocationId,
              lotId,
              stockState: stockStateForCondition(item.condition),
              quantity: acceptedDecimal.negated().toFixed(),
              unitCost: item.unitCost.toString(),
            });

            const key = item.productId.toString();
            receivedByProduct.set(
              key,
              (receivedByProduct.get(key) ?? new Decimal(0)).minus(acceptedDecimal),
            );
          }

          await postStockMovements(
            {
              organizationId: context.organizationId,
              transactionType: 'reversal',
              referenceType: 'goodsReceipt',
              referenceId: reversalDoc._id,
              referenceNumber: reversalDoc.receiptNumber,
              reasonCode: 'reversal',
              actorId: context.actorId,
              correlationId: context.correlationId,
              idempotencyKeyHash: idempotencyKey ? hashIdempotencyPayload(idempotencyKey) : null,
              movements,
            },
            session,
          );

          if (original.purchaseOrderId && receivedByProduct.size > 0) {
            await applyReceivedQuantities(
              session,
              context.organizationId,
              original.purchaseOrderId,
              receivedByProduct,
            );
          }

          original.reversedBy = context.actorId;
          original.reversedAt = new Date();
          await original.save({ session });

          return { resultRef: reversalDoc._id, result: reversalDoc.toObject() };
        },
        async (resultRef) => {
          const existing = await GoodsReceiptModel.findOne({
            _id: resultRef,
            organizationId: context.organizationId,
          }).session(session);
          if (!existing) throw new NotFoundError('Goods receipt not found.');
          return existing.toObject();
        },
      ),
    { correlationId: context.correlationId, operation: 'receiving.goodsReceipt.reverse' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'receipts.reverse',
    resourceType: 'goodsReceipt',
    resourceId: reversal._id,
    resourceNumber: reversal.receiptNumber,
    outcome: 'success',
    reason,
    correlationId: context.correlationId,
  });

  return reversal;
}

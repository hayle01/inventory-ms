import { Decimal } from 'decimal.js';
import { Types, type ClientSession, type HydratedDocument } from 'mongoose';
import type {
  CreatePurchaseOrderRequest,
  PurchaseOrderItemInput,
  UpdatePurchaseOrderRequest,
} from '@inventory-ms/contracts';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/http/errors.js';
import { withTransaction } from '../../../shared/infrastructure/mongo.js';
import { nextSequence, formatSequence } from '../../../shared/infrastructure/counters/Counter.js';
import { recordAuditEvent } from '../../audit/application/AuditService.js';
import { procurementPolicy } from '../../../config.js';
import { SupplierModel } from '../../suppliers/models/Supplier.js';
import { WarehouseModel } from '../../organization/models/Warehouse.js';
import { ProductModel } from '../../catalog/models/Product.js';
import { PurchaseOrderModel, type PurchaseOrderDoc } from '../models/PurchaseOrder.js';
import { assertPurchaseOrderTransition } from '../domain/purchaseOrderStatus.js';
import { calculateLine, calculateTotals } from '../domain/purchaseOrderCalculations.js';
import { toDecimal128 } from '../../catalog/domain/decimalMapping.js';

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

interface ResolvedLine {
  lineNumber: number;
  productId: Types.ObjectId;
  productName: string;
  productSku: string;
  orderedQuantity: ReturnType<typeof toDecimal128>;
  receivedQuantity: ReturnType<typeof toDecimal128>;
  unitCost: ReturnType<typeof toDecimal128>;
  taxAmount: ReturnType<typeof toDecimal128>;
  discountAmount: ReturnType<typeof toDecimal128>;
  lineTotal: ReturnType<typeof toDecimal128>;
}

async function resolveLines(
  organizationId: Types.ObjectId,
  items: readonly PurchaseOrderItemInput[],
): Promise<{
  lines: ResolvedLine[];
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
}> {
  const productIds = items.map((item) => new Types.ObjectId(item.productId));
  const products = await ProductModel.find({
    _id: { $in: productIds },
    organizationId,
    status: { $ne: 'archived' },
  }).lean();
  const productById = new Map(products.map((product) => [product._id.toString(), product]));

  const calculatedLines = items.map((item) => calculateLine(item));
  const { subtotal, taxTotal, discountTotal, total } = calculateTotals(calculatedLines);

  const lines: ResolvedLine[] = items.map((item, index) => {
    const product = productById.get(item.productId);
    if (!product) {
      throw new ValidationError(`Product ${item.productId} does not exist or is archived.`);
    }
    const calculated = calculatedLines[index];
    if (!calculated) throw new Error('Line calculation missing unexpectedly.');
    return {
      lineNumber: index + 1,
      productId: product._id,
      productName: product.name,
      productSku: product.sku,
      orderedQuantity: toDecimal128(calculated.quantity.toFixed()),
      receivedQuantity: toDecimal128('0'),
      unitCost: toDecimal128(calculated.unitCost.toFixed()),
      taxAmount: toDecimal128(calculated.taxAmount.toFixed()),
      discountAmount: toDecimal128(calculated.discountAmount.toFixed()),
      lineTotal: toDecimal128(calculated.lineTotal.toFixed()),
    };
  });

  return {
    lines,
    subtotal: subtotal.toFixed(),
    taxTotal: taxTotal.toFixed(),
    discountTotal: discountTotal.toFixed(),
    total: total.toFixed(),
  };
}

export async function listPurchaseOrders(
  organizationId: Types.ObjectId,
): Promise<PurchaseOrderDoc[]> {
  return PurchaseOrderModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
}

export async function getPurchaseOrderById(
  organizationId: Types.ObjectId,
  purchaseOrderId: Types.ObjectId,
): Promise<PurchaseOrderDoc> {
  const po = await PurchaseOrderModel.findOne({ _id: purchaseOrderId, organizationId }).lean();
  if (!po) throw new NotFoundError('Purchase order not found.');
  return po;
}

export async function createPurchaseOrder(
  context: OrgActionContext,
  input: CreatePurchaseOrderRequest,
): Promise<PurchaseOrderDoc> {
  const { supplierObjectId, warehouseObjectId } = await assertSupplierAndWarehouse(
    context.organizationId,
    input.supplierId,
    input.warehouseId,
  );
  const { lines, subtotal, taxTotal, discountTotal, total } = await resolveLines(
    context.organizationId,
    input.items,
  );

  const purchaseOrder = await withTransaction(
    async (session) => {
      const seq = await nextSequence(`${context.organizationId.toString()}:purchaseOrder`, session);
      const [created] = await PurchaseOrderModel.create(
        [
          {
            organizationId: context.organizationId,
            poNumber: formatSequence('PO', seq),
            supplierId: supplierObjectId,
            warehouseId: warehouseObjectId,
            status: 'draft',
            orderDate: input.orderDate ? new Date(input.orderDate) : null,
            expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
            currencyCode: input.currencyCode,
            subtotal: toDecimal128(subtotal),
            taxTotal: toDecimal128(taxTotal),
            discountTotal: toDecimal128(discountTotal),
            total: toDecimal128(total),
            items: lines,
            notes: input.notes ?? null,
            createdBy: context.actorId,
          },
        ],
        { session },
      );
      if (!created) throw new Error('Purchase order creation failed unexpectedly.');
      return created;
    },
    { correlationId: context.correlationId, operation: 'procurement.purchaseOrder.create' },
  );

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'purchase_orders.create',
    resourceType: 'purchaseOrder',
    resourceId: purchaseOrder._id,
    resourceNumber: purchaseOrder.poNumber,
    outcome: 'success',
    correlationId: context.correlationId,
  });

  return purchaseOrder.toObject();
}

export async function updatePurchaseOrder(
  context: OrgActionContext,
  purchaseOrderId: Types.ObjectId,
  input: UpdatePurchaseOrderRequest,
): Promise<PurchaseOrderDoc> {
  const po = await PurchaseOrderModel.findOne({
    _id: purchaseOrderId,
    organizationId: context.organizationId,
  });
  if (!po) throw new NotFoundError('Purchase order not found.');
  if (po.status !== 'draft') {
    throw new ValidationError('Only draft purchase orders can be edited.');
  }

  const changedFields: Record<string, unknown> = {};

  if (input.supplierId !== undefined || input.warehouseId !== undefined) {
    const { supplierObjectId, warehouseObjectId } = await assertSupplierAndWarehouse(
      context.organizationId,
      input.supplierId ?? po.supplierId.toString(),
      input.warehouseId ?? po.warehouseId.toString(),
    );
    if (input.supplierId !== undefined) {
      changedFields['supplierId'] = true;
      po.supplierId = supplierObjectId;
    }
    if (input.warehouseId !== undefined) {
      changedFields['warehouseId'] = true;
      po.warehouseId = warehouseObjectId;
    }
  }

  if (input.items !== undefined) {
    const { lines, subtotal, taxTotal, discountTotal, total } = await resolveLines(
      context.organizationId,
      input.items,
    );
    changedFields['items'] = true;
    po.items = lines as unknown as typeof po.items;
    po.subtotal = toDecimal128(subtotal);
    po.taxTotal = toDecimal128(taxTotal);
    po.discountTotal = toDecimal128(discountTotal);
    po.total = toDecimal128(total);
  }

  if (input.orderDate !== undefined) {
    changedFields['orderDate'] = true;
    po.orderDate = input.orderDate ? new Date(input.orderDate) : null;
  }
  if (input.expectedDate !== undefined) {
    changedFields['expectedDate'] = true;
    po.expectedDate = input.expectedDate ? new Date(input.expectedDate) : null;
  }
  if (input.currencyCode !== undefined) {
    changedFields['currencyCode'] = true;
    po.currencyCode = input.currencyCode;
  }
  if (input.notes !== undefined) {
    changedFields['notes'] = true;
    po.notes = input.notes;
  }

  po.version += 1;
  await po.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action: 'purchase_orders.update',
    resourceType: 'purchaseOrder',
    resourceId: po._id,
    resourceNumber: po.poNumber,
    outcome: 'success',
    correlationId: context.correlationId,
    changedFields,
  });

  return po.toObject();
}

async function transitionStatus(
  context: OrgActionContext,
  purchaseOrderId: Types.ObjectId,
  toStatus: 'submitted' | 'approved' | 'rejected' | 'cancelled',
  action: string,
  mutate: (po: HydratedDocument<PurchaseOrderDoc>) => void,
  reason?: string,
): Promise<PurchaseOrderDoc> {
  const po = await PurchaseOrderModel.findOne({
    _id: purchaseOrderId,
    organizationId: context.organizationId,
  });
  if (!po) throw new NotFoundError('Purchase order not found.');

  assertPurchaseOrderTransition(po.status, toStatus);
  mutate(po);
  po.status = toStatus;
  po.version += 1;
  await po.save();

  await recordAuditEvent({
    organizationId: context.organizationId,
    actorId: context.actorId,
    action,
    resourceType: 'purchaseOrder',
    resourceId: po._id,
    resourceNumber: po.poNumber,
    outcome: 'success',
    reason: reason ?? null,
    correlationId: context.correlationId,
  });

  return po.toObject();
}

/**
 * Applies received-quantity deltas from the Receiving module (posting or
 * reversing a goods receipt) and recomputes the derived receiving status.
 * Exposed as an application function -- not a shared model -- so Receiving
 * never imports `PurchaseOrderModel` directly (no cross-module model
 * imports). Pass a negative delta to undo a reversed receipt's quantities.
 */
export async function applyReceivedQuantities(
  session: ClientSession,
  organizationId: Types.ObjectId,
  purchaseOrderId: Types.ObjectId,
  deltasByProductId: ReadonlyMap<string, Decimal>,
): Promise<void> {
  const po = await PurchaseOrderModel.findOne({ _id: purchaseOrderId, organizationId }).session(
    session,
  );
  if (!po) throw new NotFoundError('Purchase order not found.');

  let totalOrdered = new Decimal(0);
  let totalReceived = new Decimal(0);

  for (const item of po.items) {
    const delta = deltasByProductId.get(item.productId.toString());
    if (delta) {
      const nextReceived = new Decimal(item.receivedQuantity.toString()).plus(delta);
      item.receivedQuantity = Types.Decimal128.fromString(
        nextReceived.isNegative() ? '0' : nextReceived.toFixed(),
      );
    }
    totalOrdered = totalOrdered.plus(item.orderedQuantity.toString());
    totalReceived = totalReceived.plus(item.receivedQuantity.toString());
  }

  if (
    po.status === 'approved' ||
    po.status === 'partially_received' ||
    po.status === 'fully_received'
  ) {
    if (totalReceived.lessThanOrEqualTo(0)) po.status = 'approved';
    else if (totalReceived.lessThan(totalOrdered)) po.status = 'partially_received';
    else po.status = 'fully_received';
  }

  po.version += 1;
  await po.save({ session });
}

export async function submitPurchaseOrder(
  context: OrgActionContext,
  purchaseOrderId: Types.ObjectId,
): Promise<PurchaseOrderDoc> {
  return transitionStatus(context, purchaseOrderId, 'submitted', 'purchase_orders.submit', (po) => {
    po.submittedBy = context.actorId;
    po.submittedAt = new Date();
  });
}

export async function approvePurchaseOrder(
  context: OrgActionContext,
  purchaseOrderId: Types.ObjectId,
): Promise<PurchaseOrderDoc> {
  const existing = await PurchaseOrderModel.findOne({
    _id: purchaseOrderId,
    organizationId: context.organizationId,
  }).lean();
  if (!existing) throw new NotFoundError('Purchase order not found.');
  if (procurementPolicy.preventSelfApproval && existing.createdBy?.equals(context.actorId)) {
    throw new ForbiddenError('You cannot approve a purchase order you created.');
  }

  return transitionStatus(context, purchaseOrderId, 'approved', 'purchase_orders.approve', (po) => {
    po.approvedBy = context.actorId;
    po.approvedAt = new Date();
  });
}

export async function rejectPurchaseOrder(
  context: OrgActionContext,
  purchaseOrderId: Types.ObjectId,
  reason: string,
): Promise<PurchaseOrderDoc> {
  return transitionStatus(
    context,
    purchaseOrderId,
    'rejected',
    'purchase_orders.reject',
    (po) => {
      po.rejectedBy = context.actorId;
      po.rejectedAt = new Date();
      po.rejectionReason = reason;
    },
    reason,
  );
}

export async function cancelPurchaseOrder(
  context: OrgActionContext,
  purchaseOrderId: Types.ObjectId,
  reason: string,
): Promise<PurchaseOrderDoc> {
  return transitionStatus(
    context,
    purchaseOrderId,
    'cancelled',
    'purchase_orders.cancel',
    (po) => {
      po.cancelledBy = context.actorId;
      po.cancelledAt = new Date();
      po.cancellationReason = reason;
    },
    reason,
  );
}

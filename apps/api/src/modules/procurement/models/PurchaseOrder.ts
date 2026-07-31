import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { MAX_PURCHASE_ORDER_LINES, PURCHASE_ORDER_STATUSES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const purchaseOrderItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    orderedQuantity: { type: Schema.Types.Decimal128, required: true },
    receivedQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    unitCost: { type: Schema.Types.Decimal128, required: true },
    taxAmount: { type: Schema.Types.Decimal128, required: true, default: '0' },
    discountAmount: { type: Schema.Types.Decimal128, required: true, default: '0' },
    lineTotal: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    poNumber: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: PURCHASE_ORDER_STATUSES, default: 'draft' },
    orderDate: { type: Date, default: null },
    expectedDate: { type: Date, default: null },
    currencyCode: { type: String, required: true, default: 'USD' },
    subtotal: { type: Schema.Types.Decimal128, required: true, default: '0' },
    taxTotal: { type: Schema.Types.Decimal128, required: true, default: '0' },
    discountTotal: { type: Schema.Types.Decimal128, required: true, default: '0' },
    total: { type: Schema.Types.Decimal128, required: true, default: '0' },
    items: {
      type: [purchaseOrderItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_PURCHASE_ORDER_LINES,
        message: `Purchase orders must have between 1 and ${String(MAX_PURCHASE_ORDER_LINES)} lines.`,
      },
    },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    submittedBy: { type: Schema.Types.ObjectId, default: null },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'purchaseOrders' },
);

purchaseOrderSchema.index({ organizationId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ organizationId: 1, status: 1 });
purchaseOrderSchema.index({ organizationId: 1, supplierId: 1 });

export type PurchaseOrderDoc = InferSchemaType<typeof purchaseOrderSchema> & {
  _id: Types.ObjectId;
};

export const PurchaseOrderModel: Model<PurchaseOrderDoc> = model<PurchaseOrderDoc>(
  'PurchaseOrder',
  purchaseOrderSchema,
);

registerModel('PurchaseOrder', PurchaseOrderModel);

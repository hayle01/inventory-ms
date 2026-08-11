import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import {
  GOODS_RECEIPT_STATUSES,
  MAX_GOODS_RECEIPT_LINES,
  RECEIPT_ITEM_CONDITIONS,
} from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const goodsReceiptItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    destinationLocationId: { type: Schema.Types.ObjectId, required: true },
    receivedQuantity: { type: Schema.Types.Decimal128, required: true },
    acceptedQuantity: { type: Schema.Types.Decimal128, required: true },
    rejectedQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    unitCost: { type: Schema.Types.Decimal128, required: true },
    condition: { type: String, required: true, enum: RECEIPT_ITEM_CONDITIONS, default: 'good' },
    lotNumber: { type: String, default: null },
    manufacturedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { _id: false },
);

const goodsReceiptSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    receiptNumber: { type: String, required: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, default: null },
    supplierId: { type: Schema.Types.ObjectId, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: GOODS_RECEIPT_STATUSES, default: 'draft' },
    receivedDate: { type: Date, default: null },
    supplierDocumentNumber: { type: String, default: null },
    items: {
      type: [goodsReceiptItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_GOODS_RECEIPT_LINES,
        message: `Goods receipts must have between 1 and ${String(MAX_GOODS_RECEIPT_LINES)} lines.`,
      },
    },
    notes: { type: String, default: null },
    /** Set only on a reversal receipt; points back at the receipt it undoes. */
    reversalOfId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, default: null },
    verifiedAt: { type: Date, default: null },
    postedBy: { type: Schema.Types.ObjectId, default: null },
    postedAt: { type: Date, default: null },
    /** Stamped on the *original* posted receipt once a reversal exists for it; the original is otherwise never edited. */
    reversedBy: { type: Schema.Types.ObjectId, default: null },
    reversedAt: { type: Date, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'goodsReceipts' },
);

goodsReceiptSchema.index({ organizationId: 1, receiptNumber: 1 }, { unique: true });
goodsReceiptSchema.index({ organizationId: 1, status: 1 });
goodsReceiptSchema.index({ organizationId: 1, purchaseOrderId: 1 });
goodsReceiptSchema.index({ organizationId: 1, reversalOfId: 1 });

export type GoodsReceiptDoc = InferSchemaType<typeof goodsReceiptSchema> & { _id: Types.ObjectId };

export const GoodsReceiptModel: Model<GoodsReceiptDoc> = model<GoodsReceiptDoc>(
  'GoodsReceipt',
  goodsReceiptSchema,
);

registerModel('GoodsReceipt', GoodsReceiptModel);

import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import {
  ADJUSTMENT_REASON_CODES,
  MAX_STOCK_ADJUSTMENT_LINES,
  STOCK_ADJUSTMENT_STATUSES,
  STOCK_STATES,
} from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const stockAdjustmentItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    lotId: { type: Schema.Types.ObjectId, default: null },
    lotNumber: { type: String, default: null },
    stockState: { type: String, required: true, enum: STOCK_STATES, default: 'available' },
    quantityDelta: { type: Schema.Types.Decimal128, required: true },
    /** Populated at posting time from the balance actually decremented/incremented. */
    priorQuantity: { type: Schema.Types.Decimal128, default: null },
    resultingQuantity: { type: Schema.Types.Decimal128, default: null },
    note: { type: String, default: null },
  },
  { _id: false },
);

const stockAdjustmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    adjustmentNumber: { type: String, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: STOCK_ADJUSTMENT_STATUSES, default: 'draft' },
    reasonCode: { type: String, required: true, enum: ADJUSTMENT_REASON_CODES },
    items: {
      type: [stockAdjustmentItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_STOCK_ADJUSTMENT_LINES,
        message: `Stock adjustments must have between 1 and ${String(MAX_STOCK_ADJUSTMENT_LINES)} lines.`,
      },
    },
    requiresElevatedApproval: { type: Boolean, required: true, default: false },
    evidenceNote: { type: String, default: null },
    notes: { type: String, default: null },
    /** Set only on a reversal adjustment; points back at the adjustment it undoes. */
    reversalOfId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    submittedBy: { type: Schema.Types.ObjectId, default: null },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    postedBy: { type: Schema.Types.ObjectId, default: null },
    postedAt: { type: Date, default: null },
    reversedBy: { type: Schema.Types.ObjectId, default: null },
    reversedAt: { type: Date, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'stockAdjustments' },
);

stockAdjustmentSchema.index({ organizationId: 1, adjustmentNumber: 1 }, { unique: true });
stockAdjustmentSchema.index({ organizationId: 1, status: 1 });
stockAdjustmentSchema.index({ organizationId: 1, warehouseId: 1 });
stockAdjustmentSchema.index({ organizationId: 1, reversalOfId: 1 });

export type StockAdjustmentDoc = InferSchemaType<typeof stockAdjustmentSchema> & {
  _id: Types.ObjectId;
};

export const StockAdjustmentModel: Model<StockAdjustmentDoc> = model<StockAdjustmentDoc>(
  'StockAdjustment',
  stockAdjustmentSchema,
);

registerModel('StockAdjustment', StockAdjustmentModel);

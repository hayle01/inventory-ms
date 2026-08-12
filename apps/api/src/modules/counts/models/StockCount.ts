import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { MAX_STOCK_COUNT_LINES, STOCK_COUNT_SCOPES, STOCK_COUNT_STATUSES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const stockCountItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    lotId: { type: Schema.Types.ObjectId, default: null },
    lotNumber: { type: String, default: null },
    /** Snapshotted from `stockBalances.onHandQuantity` at creation time. */
    systemQuantity: { type: Schema.Types.Decimal128, required: true },
    /** Entered by the clerk; null until counted. */
    countedQuantity: { type: Schema.Types.Decimal128, default: null },
    /** `countedQuantity - systemQuantity`, computed on submit. */
    varianceQuantity: { type: Schema.Types.Decimal128, default: null },
    note: { type: String, default: null },
  },
  { _id: false },
);

const stockCountSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    countNumber: { type: String, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: STOCK_COUNT_STATUSES, default: 'draft' },
    scope: { type: String, required: true, enum: STOCK_COUNT_SCOPES },
    blindCount: { type: Boolean, required: true, default: true },
    snapshotAt: { type: Date, required: true, default: () => new Date() },
    items: {
      type: [stockCountItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_STOCK_COUNT_LINES,
        message: `Stock counts must have between 1 and ${String(MAX_STOCK_COUNT_LINES)} lines.`,
      },
    },
    notes: { type: String, default: null },
    /** Set only on a reversal count; points back at the count it undoes. */
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
  { timestamps: true, collection: 'stockCounts' },
);

stockCountSchema.index({ organizationId: 1, countNumber: 1 }, { unique: true });
stockCountSchema.index({ organizationId: 1, status: 1 });
stockCountSchema.index({ organizationId: 1, warehouseId: 1 });
stockCountSchema.index({ organizationId: 1, reversalOfId: 1 });

export type StockCountDoc = InferSchemaType<typeof stockCountSchema> & { _id: Types.ObjectId };

export const StockCountModel: Model<StockCountDoc> = model<StockCountDoc>(
  'StockCount',
  stockCountSchema,
);

registerModel('StockCount', StockCountModel);

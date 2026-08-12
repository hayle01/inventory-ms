import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { MAX_STOCK_RETURN_LINES, STOCK_RETURN_CONDITIONS, STOCK_RETURN_STATUSES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const stockReturnItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    stockIssueLineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    lotId: { type: Schema.Types.ObjectId, default: null },
    lotNumber: { type: String, default: null },
    quantity: { type: Schema.Types.Decimal128, required: true },
    condition: { type: String, required: true, enum: STOCK_RETURN_CONDITIONS, default: 'good' },
    reason: { type: String, default: null },
  },
  { _id: false },
);

const stockReturnSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    returnNumber: { type: String, required: true },
    stockIssueId: { type: Schema.Types.ObjectId, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: STOCK_RETURN_STATUSES, default: 'draft' },
    items: {
      type: [stockReturnItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_STOCK_RETURN_LINES,
        message: `Stock returns must have between 1 and ${String(MAX_STOCK_RETURN_LINES)} lines.`,
      },
    },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    postedBy: { type: Schema.Types.ObjectId, default: null },
    postedAt: { type: Date, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'stockReturns' },
);

stockReturnSchema.index({ organizationId: 1, returnNumber: 1 }, { unique: true });
stockReturnSchema.index({ organizationId: 1, status: 1 });
stockReturnSchema.index({ organizationId: 1, stockIssueId: 1 });

export type StockReturnDoc = InferSchemaType<typeof stockReturnSchema> & { _id: Types.ObjectId };

export const StockReturnModel: Model<StockReturnDoc> = model<StockReturnDoc>(
  'StockReturn',
  stockReturnSchema,
);

registerModel('StockReturn', StockReturnModel);

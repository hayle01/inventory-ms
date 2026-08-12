import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { MAX_STOCK_REQUEST_LINES, STOCK_REQUEST_STATUSES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const stockRequestItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    requestedQuantity: { type: Schema.Types.Decimal128, required: true },
    approvedQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    reservedQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    fulfilledQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    note: { type: String, default: null },
  },
  { _id: false },
);

const stockRequestSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    requestNumber: { type: String, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: STOCK_REQUEST_STATUSES, default: 'draft' },
    neededBy: { type: Date, default: null },
    items: {
      type: [stockRequestItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_STOCK_REQUEST_LINES,
        message: `Stock requests must have between 1 and ${String(MAX_STOCK_REQUEST_LINES)} lines.`,
      },
    },
    notes: { type: String, default: null },
    requestedBy: { type: Schema.Types.ObjectId, default: null },
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
  { timestamps: true, collection: 'stockRequests' },
);

stockRequestSchema.index({ organizationId: 1, requestNumber: 1 }, { unique: true });
stockRequestSchema.index({ organizationId: 1, status: 1 });
stockRequestSchema.index({ organizationId: 1, warehouseId: 1 });
stockRequestSchema.index({ organizationId: 1, requestedBy: 1 });

export type StockRequestDoc = InferSchemaType<typeof stockRequestSchema> & {
  _id: Types.ObjectId;
};

export const StockRequestModel: Model<StockRequestDoc> = model<StockRequestDoc>(
  'StockRequest',
  stockRequestSchema,
);

registerModel('StockRequest', StockRequestModel);

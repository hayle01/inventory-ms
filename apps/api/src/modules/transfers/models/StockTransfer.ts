import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import {
  MAX_STOCK_TRANSFER_LINES,
  STOCK_TRANSFER_STATUSES,
  TRANSFER_IN_TRANSIT_POLICIES,
} from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const stockTransferItemSchema = new Schema(
  {
    lineNumber: { type: Number, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    sourceLocationId: { type: Schema.Types.ObjectId, required: true },
    destinationLocationId: { type: Schema.Types.ObjectId, required: true },
    lotId: { type: Schema.Types.ObjectId, default: null },
    lotNumber: { type: String, default: null },
    quantity: { type: Schema.Types.Decimal128, required: true },
    note: { type: String, default: null },
  },
  { _id: false },
);

const stockTransferSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    transferNumber: { type: String, required: true },
    sourceWarehouseId: { type: Schema.Types.ObjectId, required: true },
    destinationWarehouseId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, required: true, enum: STOCK_TRANSFER_STATUSES, default: 'draft' },
    inTransitPolicy: {
      type: String,
      required: true,
      enum: TRANSFER_IN_TRANSIT_POLICIES,
      default: 'in_transit',
    },
    items: {
      type: [stockTransferItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) =>
          items.length > 0 && items.length <= MAX_STOCK_TRANSFER_LINES,
        message: `Stock transfers must have between 1 and ${String(MAX_STOCK_TRANSFER_LINES)} lines.`,
      },
    },
    notes: { type: String, default: null },
    /** Set only on a reversal transfer; points back at the transfer it undoes. */
    reversalOfId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    submittedBy: { type: Schema.Types.ObjectId, default: null },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, default: null },
    approvedAt: { type: Date, default: null },
    postedBy: { type: Schema.Types.ObjectId, default: null },
    postedAt: { type: Date, default: null },
    receivedBy: { type: Schema.Types.ObjectId, default: null },
    receivedAt: { type: Date, default: null },
    reversedBy: { type: Schema.Types.ObjectId, default: null },
    reversedAt: { type: Date, default: null },
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'stockTransfers' },
);

stockTransferSchema.index({ organizationId: 1, transferNumber: 1 }, { unique: true });
stockTransferSchema.index({ organizationId: 1, status: 1 });
stockTransferSchema.index({ organizationId: 1, sourceWarehouseId: 1 });
stockTransferSchema.index({ organizationId: 1, destinationWarehouseId: 1 });
stockTransferSchema.index({ organizationId: 1, reversalOfId: 1 });

export type StockTransferDoc = InferSchemaType<typeof stockTransferSchema> & {
  _id: Types.ObjectId;
};

export const StockTransferModel: Model<StockTransferDoc> = model<StockTransferDoc>(
  'StockTransfer',
  stockTransferSchema,
);

registerModel('StockTransfer', StockTransferModel);

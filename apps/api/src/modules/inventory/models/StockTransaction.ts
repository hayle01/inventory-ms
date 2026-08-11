import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { STOCK_STATES, STOCK_TRANSACTION_TYPES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

/**
 * Authoritative, append-only inventory ledger (SYSTEM_DOCUMENTATION.md
 * section 8.8). Never updated or deleted after creation -- corrections are
 * new `reversal` rows. `stockBalances` is a derived projection, not this.
 */
const stockTransactionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    transactionNumber: { type: String, required: true },
    transactionType: { type: String, required: true, enum: STOCK_TRANSACTION_TYPES },
    transactionAt: { type: Date, required: true, default: () => new Date() },
    productId: { type: Schema.Types.ObjectId, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    lotId: { type: Schema.Types.ObjectId, default: null },
    stockState: { type: String, required: true, enum: STOCK_STATES, default: 'available' },
    /** Signed: positive for stock in, negative for stock out. */
    quantity: { type: Schema.Types.Decimal128, required: true },
    unitCost: { type: Schema.Types.Decimal128, default: null },
    referenceType: { type: String, required: true },
    referenceId: { type: Schema.Types.ObjectId, required: true },
    referenceNumber: { type: String, required: true },
    reasonCode: { type: String, default: null },
    idempotencyKeyHash: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    correlationId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'stockTransactions' },
);

stockTransactionSchema.index({ organizationId: 1, productId: 1, transactionAt: -1 });
stockTransactionSchema.index({ organizationId: 1, warehouseId: 1, transactionAt: -1 });
stockTransactionSchema.index({ organizationId: 1, lotId: 1, transactionAt: -1 });
stockTransactionSchema.index({ organizationId: 1, referenceType: 1, referenceId: 1 });
stockTransactionSchema.index({ organizationId: 1, transactionNumber: 1 }, { unique: true });

export type StockTransactionDoc = InferSchemaType<typeof stockTransactionSchema> & {
  _id: Types.ObjectId;
};

export const StockTransactionModel: Model<StockTransactionDoc> = model<StockTransactionDoc>(
  'StockTransaction',
  stockTransactionSchema,
);

registerModel('StockTransaction', StockTransactionModel);

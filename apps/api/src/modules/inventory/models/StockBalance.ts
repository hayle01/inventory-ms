import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { STOCK_STATES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

/**
 * Transactional read projection of `stockTransactions`, keyed by the same
 * dimensions as the ledger. Never the source of truth -- always derivable by
 * summing the ledger for its key. Updated in the same transaction as the
 * ledger rows that move it.
 */
const stockBalanceSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true },
    locationId: { type: Schema.Types.ObjectId, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    lotId: { type: Schema.Types.ObjectId, default: null },
    stockState: { type: String, required: true, enum: STOCK_STATES, default: 'available' },
    onHandQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    reservedQuantity: { type: Schema.Types.Decimal128, required: true, default: '0' },
    version: { type: Number, required: true, default: 0 },
    lastTransactionAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'stockBalances' },
);

stockBalanceSchema.index(
  { organizationId: 1, warehouseId: 1, locationId: 1, productId: 1, lotId: 1, stockState: 1 },
  { unique: true },
);
stockBalanceSchema.index({ organizationId: 1, productId: 1 });

export type StockBalanceDoc = InferSchemaType<typeof stockBalanceSchema> & { _id: Types.ObjectId };

export const StockBalanceModel: Model<StockBalanceDoc> = model<StockBalanceDoc>(
  'StockBalance',
  stockBalanceSchema,
);

registerModel('StockBalance', StockBalanceModel);

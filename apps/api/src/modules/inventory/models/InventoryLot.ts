import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const inventoryLotSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    supplierId: { type: Schema.Types.ObjectId, default: null },
    lotNumber: { type: String, required: true, trim: true },
    manufacturedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    receivedAt: { type: Date, required: true, default: () => new Date() },
    status: { type: String, required: true, enum: ['active', 'expired'], default: 'active' },
  },
  { timestamps: true, collection: 'inventoryLots' },
);

inventoryLotSchema.index({ organizationId: 1, productId: 1, lotNumber: 1 }, { unique: true });
inventoryLotSchema.index({ organizationId: 1, expiresAt: 1 });

export type InventoryLotDoc = InferSchemaType<typeof inventoryLotSchema> & { _id: Types.ObjectId };

export const InventoryLotModel: Model<InventoryLotDoc> = model<InventoryLotDoc>(
  'InventoryLot',
  inventoryLotSchema,
);

registerModel('InventoryLot', InventoryLotModel);

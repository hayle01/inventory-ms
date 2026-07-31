import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const warehouseSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: null },
    isDefault: { type: Boolean, required: true, default: false },
    status: { type: String, required: true, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true, collection: 'warehouses' },
);

warehouseSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export type WarehouseDoc = InferSchemaType<typeof warehouseSchema> & { _id: Types.ObjectId };

export const WarehouseModel: Model<WarehouseDoc> = model<WarehouseDoc>(
  'Warehouse',
  warehouseSchema,
);

registerModel('Warehouse', WarehouseModel);

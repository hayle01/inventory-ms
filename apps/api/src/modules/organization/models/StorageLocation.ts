import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { LOCATION_TYPES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const storageLocationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    warehouseId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    locationType: { type: String, required: true, enum: LOCATION_TYPES, default: 'normal' },
    status: { type: String, required: true, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true, collection: 'storageLocations' },
);

storageLocationSchema.index({ warehouseId: 1, code: 1 }, { unique: true });

export type StorageLocationDoc = InferSchemaType<typeof storageLocationSchema> & {
  _id: Types.ObjectId;
};

export const StorageLocationModel: Model<StorageLocationDoc> = model<StorageLocationDoc>(
  'StorageLocation',
  storageLocationSchema,
);

registerModel('StorageLocation', StorageLocationModel);

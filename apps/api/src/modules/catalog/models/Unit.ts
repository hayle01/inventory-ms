import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const unitSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    symbol: { type: String, required: true, trim: true },
    decimalPlaces: { type: Number, required: true, default: 0, min: 0, max: 6 },
    status: { type: String, required: true, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true, collection: 'units' },
);

unitSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export type UnitDoc = InferSchemaType<typeof unitSchema> & { _id: Types.ObjectId };

export const UnitModel: Model<UnitDoc> = model<UnitDoc>('Unit', unitSchema);

registerModel('Unit', UnitModel);

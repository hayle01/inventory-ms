import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const supplierSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    addressLine: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    taxIdentifier: { type: String, default: null },
    notes: { type: String, default: null },
    status: { type: String, required: true, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true, collection: 'suppliers' },
);

supplierSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export type SupplierDoc = InferSchemaType<typeof supplierSchema> & { _id: Types.ObjectId };

export const SupplierModel: Model<SupplierDoc> = model<SupplierDoc>('Supplier', supplierSchema);

registerModel('Supplier', SupplierModel);

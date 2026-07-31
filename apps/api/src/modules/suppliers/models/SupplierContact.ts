import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const supplierContactSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    jobTitle: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    isPrimary: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: 'supplierContacts' },
);

export type SupplierContactDoc = InferSchemaType<typeof supplierContactSchema> & {
  _id: Types.ObjectId;
};

export const SupplierContactModel: Model<SupplierContactDoc> = model<SupplierContactDoc>(
  'SupplierContact',
  supplierContactSchema,
);

registerModel('SupplierContact', SupplierContactModel);

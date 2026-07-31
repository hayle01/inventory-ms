import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const organizationSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    timezone: { type: String, required: true, default: 'UTC' },
    currencyCode: { type: String, required: true, default: 'USD', minlength: 3, maxlength: 3 },
    status: { type: String, required: true, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true, collection: 'organizations' },
);

export type OrganizationDoc = InferSchemaType<typeof organizationSchema> & { _id: Types.ObjectId };

export const Organization: Model<OrganizationDoc> = model<OrganizationDoc>(
  'Organization',
  organizationSchema,
);

registerModel('Organization', Organization);

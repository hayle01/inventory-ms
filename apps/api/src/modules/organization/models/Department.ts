import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const departmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    managerUserId: { type: Schema.Types.ObjectId, default: null },
    status: { type: String, required: true, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true, collection: 'departments' },
);

departmentSchema.index({ organizationId: 1, code: 1 }, { unique: true });

export type DepartmentDoc = InferSchemaType<typeof departmentSchema> & { _id: Types.ObjectId };

export const DepartmentModel: Model<DepartmentDoc> = model<DepartmentDoc>(
  'Department',
  departmentSchema,
);

registerModel('Department', DepartmentModel);

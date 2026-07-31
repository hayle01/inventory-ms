import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const roleSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    permissionNames: { type: [String], required: true, default: [] },
    isSystem: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'roles' },
);

roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export type RoleDoc = InferSchemaType<typeof roleSchema> & { _id: Types.ObjectId };

export const RoleModel: Model<RoleDoc> = model<RoleDoc>('Role', roleSchema);

registerModel('Role', RoleModel);

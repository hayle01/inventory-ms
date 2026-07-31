import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const permissionSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    module: { type: String, required: true, index: true },
    riskLevel: { type: String, required: true, enum: ['low', 'medium', 'high'] },
  },
  { timestamps: true, collection: 'permissions' },
);

export type PermissionDoc = InferSchemaType<typeof permissionSchema>;

export const PermissionModel: Model<PermissionDoc> = model<PermissionDoc>(
  'Permission',
  permissionSchema,
);

registerModel('Permission', PermissionModel);

import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { USER_STATUSES } from '@inventory-ms/contracts';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const mfaSchema = new Schema(
  {
    enabled: { type: Boolean, required: true, default: false },
    secretCiphertext: { type: String, default: null },
    recoveryCodeHashes: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    usernameNormalized: { type: String, required: true, trim: true, lowercase: true },
    emailNormalized: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, required: true, enum: USER_STATUSES, default: 'invited' },
    departmentId: { type: Schema.Types.ObjectId, default: null },
    warehouseScopeIds: { type: [Schema.Types.ObjectId], required: true, default: [] },
    roleIds: { type: [Schema.Types.ObjectId], required: true, default: [] },
    directPermissionNames: { type: [String], required: true, default: [] },
    mfa: { type: mfaSchema, required: true, default: () => ({}) },
    failedLoginCount: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, required: true, default: () => new Date() },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' },
);

userSchema.index({ organizationId: 1, usernameNormalized: 1 }, { unique: true });
userSchema.index({ organizationId: 1, emailNormalized: 1 }, { unique: true });
userSchema.index({ organizationId: 1, status: 1 });
userSchema.index({ organizationId: 1, departmentId: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

export const UserModel: Model<UserDoc> = model<UserDoc>('User', userSchema);

registerModel('User', UserModel);

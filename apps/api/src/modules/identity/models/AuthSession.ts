import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const authSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    sessionIdHash: { type: String, required: true, unique: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    lastSeenAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    ipHash: { type: String, default: null },
    userAgentSummary: { type: String, default: null },
    mfaLevel: { type: String, required: true, enum: ['none', 'verified'], default: 'none' },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
  },
  { collection: 'authSessions' },
);

authSessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ userId: 1, revokedAt: 1 });

export type AuthSessionDoc = InferSchemaType<typeof authSessionSchema> & { _id: Types.ObjectId };

export const AuthSessionModel: Model<AuthSessionDoc> = model<AuthSessionDoc>(
  'AuthSession',
  authSessionSchema,
);

registerModel('AuthSession', AuthSessionModel);

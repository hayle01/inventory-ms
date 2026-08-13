import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

/**
 * Two kinds of document share this collection, distinguished by which hash
 * is set: a "challenge" doc (`codeHash` set, `tokenHash` null) created by
 * forgotPassword() for the emailed 6-digit code, and a "token" doc
 * (`tokenHash` set, `codeHash` null) created by verifyResetCode() once the
 * code is confirmed, consumed by the existing resetPassword(). Splitting it
 * this way means the raw reset token is only ever handed to a client that
 * has already proven code ownership, and only the hash of either secret is
 * ever persisted.
 */
const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    // No `default: null` here on purpose -- a sparse index only skips
    // documents where the field is entirely absent, not documents where
    // it's explicitly null. A default would make every "challenge" doc
    // (code-only, no token yet) store `tokenHash: null` literally, which
    // collides with every other one under the unique index.
    tokenHash: { type: String, unique: true, sparse: true },
    codeHash: { type: String, default: null },
    codeAttempts: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, required: true, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    requestIpHash: { type: String, default: null },
  },
  { collection: 'passwordResetTokens' },
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenDoc = InferSchemaType<typeof passwordResetTokenSchema> & {
  _id: Types.ObjectId;
};

export const PasswordResetTokenModel: Model<PasswordResetTokenDoc> = model<PasswordResetTokenDoc>(
  'PasswordResetToken',
  passwordResetTokenSchema,
);

registerModel('PasswordResetToken', PasswordResetTokenModel);

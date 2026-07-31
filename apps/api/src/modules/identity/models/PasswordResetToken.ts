import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';
import { registerModel } from '../../../shared/infrastructure/modelRegistry.js';

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
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

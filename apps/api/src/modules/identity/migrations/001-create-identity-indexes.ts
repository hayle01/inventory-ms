import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { UserModel } from '../models/User.js';
import { AuthSessionModel } from '../models/AuthSession.js';
import { PasswordResetTokenModel } from '../models/PasswordResetToken.js';

export const createIdentityIndexesMigration: Migration = {
  id: '001-identity-create-indexes',
  description: 'Create indexes for users, authSessions, and passwordResetTokens',
  up: async () => {
    await UserModel.createIndexes();
    await AuthSessionModel.createIndexes();
    await PasswordResetTokenModel.createIndexes();
  },
};

import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createIdentityIndexesMigration } from './001-create-identity-indexes.js';

export const identityMigrations: readonly Migration[] = [createIdentityIndexesMigration];

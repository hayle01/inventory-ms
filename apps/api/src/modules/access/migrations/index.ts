import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { seedPermissionsMigration } from './001-seed-permissions.js';
import { createAccessIndexesMigration } from './002-create-access-indexes.js';

export const accessMigrations: readonly Migration[] = [
  seedPermissionsMigration,
  createAccessIndexesMigration,
];

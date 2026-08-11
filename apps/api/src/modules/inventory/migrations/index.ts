import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createInventoryIndexesMigration } from './001-create-inventory-indexes.js';

export const inventoryMigrations: readonly Migration[] = [createInventoryIndexesMigration];

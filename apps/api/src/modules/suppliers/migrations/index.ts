import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createSupplierIndexesMigration } from './001-create-supplier-indexes.js';

export const supplierMigrations: readonly Migration[] = [createSupplierIndexesMigration];

import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createProcurementIndexesMigration } from './001-create-procurement-indexes.js';

export const procurementMigrations: readonly Migration[] = [createProcurementIndexesMigration];

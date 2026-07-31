import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createCatalogIndexesMigration } from './001-create-catalog-indexes.js';

export const catalogMigrations: readonly Migration[] = [createCatalogIndexesMigration];

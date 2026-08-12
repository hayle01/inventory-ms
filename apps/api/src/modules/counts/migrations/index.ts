import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createCountsIndexesMigration } from './001-create-counts-indexes.js';

export const countsMigrations: readonly Migration[] = [createCountsIndexesMigration];

import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createReceivingIndexesMigration } from './001-create-receiving-indexes.js';

export const receivingMigrations: readonly Migration[] = [createReceivingIndexesMigration];

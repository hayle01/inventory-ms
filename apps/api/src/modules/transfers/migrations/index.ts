import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createTransfersIndexesMigration } from './001-create-transfers-indexes.js';

export const transfersMigrations: readonly Migration[] = [createTransfersIndexesMigration];

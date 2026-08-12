import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createAdjustmentsIndexesMigration } from './001-create-adjustments-indexes.js';

export const adjustmentsMigrations: readonly Migration[] = [createAdjustmentsIndexesMigration];

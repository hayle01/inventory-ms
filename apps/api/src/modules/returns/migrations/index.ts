import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createReturnsIndexesMigration } from './001-create-returns-indexes.js';

export const returnsMigrations: readonly Migration[] = [createReturnsIndexesMigration];

import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createRequestsIndexesMigration } from './001-create-requests-indexes.js';

export const requestsMigrations: readonly Migration[] = [createRequestsIndexesMigration];

import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createIssuesIndexesMigration } from './001-create-issues-indexes.js';

export const issuesMigrations: readonly Migration[] = [createIssuesIndexesMigration];

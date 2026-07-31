import type { Migration } from '../../../shared/infrastructure/migrations/runner.js';
import { createOrganizationIndexesMigration } from './001-create-organization-indexes.js';

export const organizationMigrations: readonly Migration[] = [createOrganizationIndexesMigration];
